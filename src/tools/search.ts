import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { Tool } from "../types.ts";
import { escapeRegExp, globToRegex, walk, relativePath } from "./utils.ts";

const MAX_RESULTS = 100;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

function normalizeRel(p: string): string {
  return p.replace(/\\/g, "/");
}

async function searchFiles(
  root: string,
  query: string,
  caseSensitive: boolean,
  regex: boolean,
  glob: string | undefined,
): Promise<string[]> {
  const flags = caseSensitive ? "g" : "gi";
  const pattern = regex
    ? new RegExp(query, flags)
    : new RegExp(escapeRegExp(query), flags);

  const globRegex = glob ? globToRegex(glob, caseSensitive ? "" : "i") : null;

  const results: string[] = [];
  for await (const filePath of walk(root, {
    excludeDirs: new Set(["node_modules", ".git", "dist", "build"]),
  })) {
    const rel = normalizeRel(relativePath(root, filePath));
    if (globRegex && !globRegex.test(rel)) continue;

    try {
      const s = await stat(filePath);
      if (!s.isFile() || s.size > MAX_FILE_BYTES) continue;
      const text = await readFile(filePath, "utf-8");

      pattern.lastIndex = 0;
      const matches: number[] = [];
      let m;
      while ((m = pattern.exec(text)) !== null) {
        matches.push(m.index);
        if (m.index === pattern.lastIndex) pattern.lastIndex++;
        if (matches.length >= 20) break;
      }

      if (matches.length > 0) {
        const lines = matches.map((idx) => {
          const lineStart = text.lastIndexOf("\n", idx) + 1;
          const lineEnd = text.indexOf("\n", idx);
          const snippet = text
            .slice(lineStart, lineEnd === -1 ? undefined : lineEnd)
            .trim();
          const lineNumber = text.slice(0, idx).split("\n").length;
          return `${lineNumber}: ${snippet}`;
        });
        results.push(`${rel}\n${lines.map((l) => "  " + l).join("\n")}`);
        if (results.length >= MAX_RESULTS) break;
      }
    } catch {
      // skip unreadable files
    }
  }
  return results;
}

export const searchTool: Tool = {
  name: "search",
  description:
    "Search for text inside files under a directory. Supports regex and optional file glob.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Directory path relative to the current folder",
        default: ".",
      },
      query: { type: "string", description: "Text or regex pattern to find" },
      caseSensitive: {
        type: "boolean",
        description: "Case-sensitive search",
        default: false,
      },
      regex: {
        type: "boolean",
        description: "Treat query as a regular expression",
        default: false,
      },
      glob: {
        type: "string",
        description: "Optional glob to filter files, e.g. *.ts",
      },
    },
    required: ["query"],
  },
  async execute(args) {
    const root = resolve(process.cwd(), String(args.path ?? "."));
    const query = String(args.query ?? "");
    const caseSensitive = Boolean(args.caseSensitive ?? false);
    const regex = Boolean(args.regex ?? false);
    const glob = args.glob ? String(args.glob) : undefined;
    if (!query) return "Error: query is required";
    const results = await searchFiles(root, query, caseSensitive, regex, glob);
    if (results.length === 0) return "(no matches)";
    return results.join("\n\n");
  },
};

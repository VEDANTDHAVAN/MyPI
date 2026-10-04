import { readFile } from "node:fs/promises";
import { readdir, stat } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import type { Tool } from "../types.ts";

const MAX_RESULTS = 100;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

async function* walk(
  dir: string,
  base: string,
  excludeDirs: Set<string>,
): AsyncGenerator<string> {
  const items = await readdir(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.name.startsWith(".")) continue;
    const fullPath = join(dir, item.name);
    if (item.isDirectory()) {
      if (!excludeDirs.has(item.name)) yield* walk(fullPath, base, excludeDirs);
    } else if (item.isFile()) {
      yield fullPath;
    }
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
}

async function searchFiles(
  root: string,
  query: string,
  caseSensitive: boolean,
  regex: boolean,
  glob: string | undefined,
): Promise<string[]> {
  const pattern = regex
    ? new RegExp(query, caseSensitive ? "g" : "gi")
    : new RegExp(escapeRegExp(query), caseSensitive ? "g" : "gi");

  const globRegex = glob
    ? new RegExp(
        "^" +
          glob
            .split("*")
            .map((s) => escapeRegExp(s))
            .join(".*") +
          "$",
        caseSensitive ? "" : "i",
      )
    : null;

  const results: string[] = [];
  for await (const filePath of walk(root, root, new Set(["node_modules", ".git", "dist", "build"]))) {
    if (globRegex && !globRegex.test(filePath)) continue;
    try {
      const s = await stat(filePath);
      if (!s.isFile() || s.size > MAX_FILE_BYTES) continue;
      const text = await readFile(filePath, "utf-8");
      const matches: number[] = [];
      let m;
      while ((m = pattern.exec(text)) !== null) {
        matches.push(m.index);
        if (m.index === pattern.lastIndex) pattern.lastIndex++;
        if (matches.length >= 20) break;
      }
      if (matches.length > 0) {
        const rel = relative(root, filePath);
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

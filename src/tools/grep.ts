import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { Tool } from "../types.ts";
import { escapeRegExp, globToRegex, walk, relativePath } from "./utils.ts";

const MAX_RESULTS = 100;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

function normalizeRel(p: string): string {
  return p.replace(/\\/g, "/");
}

export const grepTool: Tool = {
  name: "grep",
  description:
    "Search file contents with line context. Alias for search with simpler defaults.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Directory path relative to the current folder",
        default: ".",
      },
      query: { type: "string", description: "Text to find" },
      glob: {
        type: "string",
        description: "Optional glob filter, e.g. *.ts",
      },
      context: {
        type: "number",
        description: "Lines of context around each match",
        default: 2,
      },
    },
    required: ["query"],
  },
  async execute(args) {
    const root = resolve(process.cwd(), String(args.path ?? "."));
    const query = String(args.query ?? "");
    const glob = args.glob ? String(args.glob) : undefined;
    const context = Math.max(0, Math.min(5, Number(args.context ?? 2)));
    if (!query) return "Error: query is required";

    const globRegex = glob ? globToRegex(glob, "i") : null;
    const pattern = new RegExp(escapeRegExp(query), "gi");
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
        const lines = text.split("\n");
        const matched: number[] = [];
        for (let i = 0; i < lines.length; i++) {
          pattern.lastIndex = 0;
          if (pattern.test(lines[i])) matched.push(i);
        }
        if (matched.length === 0) continue;

        const out: string[] = [`${rel}:`];
        for (const idx of matched) {
          const start = Math.max(0, idx - context);
          const end = Math.min(lines.length - 1, idx + context);
          for (let i = start; i <= end; i++) {
            const marker = i === idx ? ">" : " ";
            out.push(`${marker}${String(i + 1).padStart(4)}: ${lines[i]}`);
          }
          if (context > 0) out.push("---");
        }
        results.push(out.join("\n"));
        if (results.length >= MAX_RESULTS) break;
      } catch {
        // skip unreadable files
      }
    }
    if (results.length === 0) return "(no matches)";
    return results.join("\n\n");
  },
};

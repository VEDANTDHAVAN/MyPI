import { resolve, basename } from "node:path";
import type { Tool } from "../types.ts";
import { globToRegex, walk, relativePath } from "./utils.ts";

const MAX_RESULTS = 200;

function normalizeRel(p: string): string {
  return p.replace(/\\/g, "/");
}

export const findTool: Tool = {
  name: "find",
  description:
    "Find files by name under a directory. Supports exact, substring, or glob-style matching.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Directory path relative to the current folder",
        default: ".",
      },
      name: {
        type: "string",
        description: "File name or glob pattern to match",
      },
      mode: {
        type: "string",
        enum: ["exact", "contains", "glob"],
        description: "Match mode",
        default: "contains",
      },
    },
    required: ["name"],
  },
  async execute(args) {
    const root = resolve(process.cwd(), String(args.path ?? "."));
    const name = String(args.name ?? "");
    const mode = String(args.mode ?? "contains") as
      | "exact"
      | "contains"
      | "glob";
    if (!name) return "Error: name is required";

    const exact = mode === "exact";
    const glob = mode === "glob";
    const lowerName = name.toLowerCase();

    const globRegex = glob ? globToRegex(name, "i") : null;

    const results: string[] = [];
    for await (const filePath of walk(root, {
      excludeDirs: new Set(["node_modules", ".git", "dist", "build"]),
    })) {
      const fileName = basename(filePath);
      const rel = normalizeRel(relativePath(root, filePath));

      let match = false;
      if (exact) {
        match = fileName === name;
      } else if (glob) {
        match = globRegex!.test(rel);
      } else {
        match = fileName.toLowerCase().includes(lowerName);
      }

      if (match) {
        results.push(rel);
        if (results.length >= MAX_RESULTS) break;
      }
    }
    if (results.length === 0) return "(no matches)";
    return results.join("\n");
  },
};

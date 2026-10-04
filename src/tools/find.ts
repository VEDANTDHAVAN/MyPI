import { readdir, stat } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import type { Tool } from "../types.ts";

const MAX_RESULTS = 200;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
}

async function* walk(dir: string): AsyncGenerator<string> {
  const items = await readdir(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.name.startsWith(".")) continue;
    const fullPath = join(dir, item.name);
    if (item.isDirectory()) yield* walk(fullPath);
    else if (item.isFile()) yield fullPath;
  }
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
    const mode = String(args.mode ?? "contains") as "exact" | "contains" | "glob";
    if (!name) return "Error: name is required";

    const exact = mode === "exact";
    const glob = mode === "glob";
    const lowerName = name.toLowerCase();

    let matcher: (fileName: string) => boolean;
    if (exact) {
      matcher = (n) => n === name;
    } else if (glob) {
      const regex = new RegExp(
        "^" +
          escapeRegExp(name).replace(/\\*/g, ".*").replace(/\\?/g, ".") +
          "$",
        "i",
      );
      matcher = (n) => regex.test(n);
    } else {
      matcher = (n) => n.toLowerCase().includes(lowerName);
    }

    const results: string[] = [];
    for await (const filePath of walk(root)) {
      const fileName = filePath.slice(filePath.lastIndexOf("/") + 1);
      if (matcher(fileName)) {
        results.push(relative(root, filePath));
        if (results.length >= MAX_RESULTS) break;
      }
    }
    if (results.length === 0) return "(no matches)";
    return results.join("\n");
  },
};

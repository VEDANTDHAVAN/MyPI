import { readdir, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import type { Tool } from "../types.ts";

type Entry = {
  name: string;
  type: "file" | "directory" | "symlink" | "unknown";
  size: number;
  modified: string;
};

async function listDir(dir: string, recursive: boolean): Promise<Entry[]> {
  const entries: Entry[] = [];
  async function walk(current: string, prefix: string) {
    const items = await readdir(current, { withFileTypes: true });
    for (const item of items) {
      const fullPath = join(current, item.name);
      const displayName = prefix + item.name;
      let type: Entry["type"] = "unknown";
      let size = 0;
      let modified = "";
      try {
        const s = await stat(fullPath);
        size = s.size;
        modified = s.mtime.toISOString();
        if (item.isDirectory()) type = "directory";
        else if (item.isFile()) type = "file";
        else if (item.isSymbolicLink()) type = "symlink";
      } catch {
        // stat failed, keep unknown
      }
      entries.push({ name: displayName, type, size, modified });
      if (recursive && item.isDirectory()) {
        await walk(fullPath, prefix + item.name + "/");
      }
    }
  }
  await walk(dir, "");
  return entries;
}

export const listTool: Tool = {
  name: "list",
  description:
    "List files and directories. Optionally recurse into subdirectories.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Directory path relative to the current folder",
        default: ".",
      },
      recursive: {
        type: "boolean",
        description: "Whether to list recursively",
        default: false,
      },
    },
    required: [],
  },
  async execute(args) {
    const dir = resolve(process.cwd(), String(args.path ?? "."));
    const recursive = Boolean(args.recursive ?? false);
    try {
      const entries = await listDir(dir, recursive);
      if (entries.length === 0) return "(empty directory)";
      return entries
        .map((e) => `${e.type.padEnd(9)} ${String(e.size).padStart(10)} ${e.modified ? e.modified + " " : ""}${e.name}`)
        .join("\n");
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
};

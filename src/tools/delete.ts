import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import type { Tool } from "../types.ts";

export const deleteTool: Tool = {
  name: "delete",
  description:
    "Delete a file or directory. Use recursive=true to delete directories.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to delete relative to the current folder",
      },
      recursive: {
        type: "boolean",
        description: "Recursively delete directories (default false)",
        default: false,
      },
    },
    required: ["path"],
  },
  async execute(args) {
    const target = resolve(process.cwd(), String(args.path));
    const recursive = Boolean(args.recursive ?? false);
    try {
      await rm(target, { recursive, force: true });
      return `deleted ${target}`;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
};

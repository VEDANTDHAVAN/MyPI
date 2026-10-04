import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Tool } from "../types.ts";
import { escapeRegExp } from "./utils.ts";

export const editTool: Tool = {
  name: "edit",
  description:
    "Replace one or all occurrences of an exact string in a file with another string.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file relative to the current folder",
      },
      oldString: {
        type: "string",
        description: "Exact text to replace",
      },
      newString: {
        type: "string",
        description: "Replacement text",
      },
      all: {
        type: "boolean",
        description: "Replace all occurrences (default false = first only)",
        default: false,
      },
    },
    required: ["path", "oldString", "newString"],
  },
  async execute(args) {
    const filePath = resolve(process.cwd(), String(args.path));
    const oldString = String(args.oldString);
    const newString = String(args.newString);
    const all = Boolean(args.all ?? false);
    if (!oldString) return "Error: oldString is required";
    try {
      const content = await readFile(filePath, "utf-8");
      if (!content.includes(oldString)) {
        return `Error: oldString not found in ${filePath}`;
      }
      const updated = all
        ? content.split(oldString).join(newString)
        : content.replace(oldString, newString);
      await writeFile(filePath, updated, "utf-8");
      const count = all
        ? (content.match(new RegExp(escapeRegExp(oldString), "g")) || []).length
        : 1;
      return `replaced ${count} occurrence(s) in ${filePath}`;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
};

import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import type { Tool } from "../types.ts";

export const writeTool: Tool = {
  name: "write",
  description:
    "Create or overwrite a text file. Parent directories are created automatically.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file relative to the current folder",
      },
      content: {
        type: "string",
        description: "Full content to write",
      },
    },
    required: ["path", "content"],
  },
  async execute(args) {
    const filePath = resolve(process.cwd(), String(args.path));
    const content = String(args.content ?? "");
    try {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content, "utf-8");
      return `wrote ${filePath} (${Buffer.byteLength(content)} bytes)`;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
};

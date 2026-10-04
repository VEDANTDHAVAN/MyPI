import { stat, lstat } from "node:fs/promises";
import { resolve } from "node:path";
import type { Tool } from "../types.ts";

export const statsTool: Tool = {
  name: "stats",
  description:
    "Get detailed file or directory metadata: size, type, permissions, timestamps, etc.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file or directory relative to the current folder",
      },
      followSymlinks: {
        type: "boolean",
        description: "Follow symbolic links (default true)",
        default: true,
      },
    },
    required: ["path"],
  },
  async execute(args) {
    const target = resolve(process.cwd(), String(args.path));
    const followSymlinks = Boolean(args.followSymlinks ?? true);
    try {
      const s = followSymlinks ? await stat(target) : await lstat(target);
      const type = s.isFile()
        ? "file"
        : s.isDirectory()
          ? "directory"
          : s.isSymbolicLink()
            ? "symlink"
            : s.isBlockDevice()
              ? "block device"
              : s.isCharacterDevice()
                ? "character device"
                : s.isFIFO()
                  ? "fifo"
                  : s.isSocket()
                    ? "socket"
                    : "unknown";
      const mode = (s.mode & 0o777).toString(8).padStart(3, "0");
      return [
        `path:        ${target}`,
        `type:        ${type}`,
        `size:        ${s.size}`,
        `mode:        ${mode}`,
        `created:     ${s.birthtime.toISOString()}`,
        `modified:    ${s.mtime.toISOString()}`,
        `accessed:    ${s.atime.toISOString()}`,
        `isFile:      ${s.isFile()}`,
        `isDirectory: ${s.isDirectory()}`,
        `isSymlink:   ${s.isSymbolicLink()}`,
      ].join("\n");
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
};

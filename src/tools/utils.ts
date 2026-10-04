import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function globToRegex(glob: string, flags?: string): RegExp {
  const pattern =
    "^" +
    glob
      .split("*")
      .map((s) => escapeRegExp(s))
      .join(".*") +
    "$";
  return new RegExp(pattern, flags ?? "i");
}

export async function* walk(
  dir: string,
  options: {
    excludeDirs?: Set<string>;
    skipHidden?: boolean;
  } = {},
): AsyncGenerator<string> {
  const excludeDirs = options.excludeDirs ?? new Set();
  const skipHidden = options.skipHidden ?? true;
  const items = await readdir(dir, { withFileTypes: true });
  for (const item of items) {
    if (skipHidden && item.name.startsWith(".")) continue;
    const fullPath = join(dir, item.name);
    if (item.isDirectory()) {
      if (!excludeDirs.has(item.name)) {
        yield* walk(fullPath, options);
      }
    } else if (item.isFile()) {
      yield fullPath;
    }
  }
}

export function relativePath(root: string, filePath: string): string {
  const rel = relative(root, filePath);
  return rel || ".";
}

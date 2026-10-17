import { existsSync } from "node:fs";
import { dirname, join } from "path";

/**
 * Project root, found by walking up from this file until a package.json is
 * seen. Works from both src/ and the bundled dist/ (where import.meta.dir
 * differs), so data paths never resolve inside dist.
 */
function findRootDir(start: string): string {
  let dir = start;
  while (!existsSync(join(dir, "package.json"))) {
    const parent = dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
  return dir;
}

export const ROOT_DIR = findRootDir(import.meta.dir);
export const THEMES_DIR = join(ROOT_DIR, "data/themes");

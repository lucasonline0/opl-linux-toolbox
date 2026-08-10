import path from "path";

/** True only when target is a descendant of root (or root itself when allowed). */
export function isPathContained(
  root: string,
  target: string,
  allowRoot = false,
): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget === resolvedRoot) return allowRoot;
  const relative = path.relative(resolvedRoot, resolvedTarget);
  return relative !== "" && !relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative);
}
export function assertPathContained(root: string, target: string): string {
  const resolved = path.resolve(target);
  if (!isPathContained(root, resolved)) {
    throw new Error(`Unsafe path outside library root: ${target}`);
  }
  return resolved;
}

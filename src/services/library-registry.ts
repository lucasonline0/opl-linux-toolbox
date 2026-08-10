import path from "path";

const roots = new Set<string>();

export function registerLibraryRoot(root: string): string {
  const resolved = path.resolve(root);
  roots.add(resolved);
  return resolved;
}
export function requireLibraryRoot(root: string): string {
  const resolved = path.resolve(root);
  if (!roots.has(resolved)) throw new Error("Library root is not registered by the backend");
  return resolved;
}

export function unregisterLibraryRoot(root: string): void {
  roots.delete(path.resolve(root));
}

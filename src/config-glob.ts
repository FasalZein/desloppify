export function matchesConfigGlob(path: string, pattern: string): boolean {
  if (!pattern.includes("*")) return path === pattern || path.endsWith(`/${pattern}`) || path.includes(pattern);
  const doubleStarToken = "__DESLOPPIFY_DOUBLE_STAR__";
  const escaped = pattern
    .replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
    .replace(/\*\*/g, doubleStarToken)
    .replace(/\*/g, "[^/]*")
    .replaceAll(doubleStarToken, ".*");
  return new RegExp(`^${escaped}$`).test(path);
}

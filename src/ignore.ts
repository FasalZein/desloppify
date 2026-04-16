import { resolve, relative } from "path";

/**
 * Loads .desloppifyignore patterns and provides file/line filtering.
 * Supports gitignore-style patterns for file exclusion and
 * inline `desloppify:ignore RULE_ID` comments for line-level suppression.
 */

let cachedPatterns: RegExp[] | null = null;
let cachedRoot: string | null = null;

export async function loadIgnorePatterns(projectRoot: string): Promise<RegExp[]> {
  if (cachedPatterns && cachedRoot === projectRoot) return cachedPatterns;

  const ignorePath = resolve(projectRoot, ".desloppifyignore");
  const patterns: RegExp[] = [];

  try {
    const file = Bun.file(ignorePath);
    if (await file.exists()) {
      const content = await file.text();
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        patterns.push(globToRegex(trimmed));
      }
    }
  } catch {
    // No ignore file, that's fine
  }

  cachedPatterns = patterns;
  cachedRoot = projectRoot;
  return patterns;
}

export function isFileIgnored(filePath: string, projectRoot: string, patterns: RegExp[]): boolean {
  const rel = relative(projectRoot, filePath);
  return patterns.some((p) => p.test(rel) || p.test(filePath));
}

export function isLineIgnored(line: string, ruleId: string): boolean {
  const match = line.match(/desloppify:ignore\s+(\S+)/);
  if (!match) return false;
  const ignored = match[1];
  return ignored === ruleId || ignored === "*";
}

function globToRegex(pattern: string): RegExp {
  // Simple gitignore-style glob to regex
  let re = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")  // escape special regex chars
    .replace(/\*\*/g, "{{GLOBSTAR}}")        // preserve **
    .replace(/\*/g, "[^/]*")                 // * = anything except /
    .replace(/\{\{GLOBSTAR\}\}/g, ".*")      // ** = anything including /
    .replace(/\?/g, "[^/]");                 // ? = single char except /

  // If pattern ends with /, match directory prefix
  if (pattern.endsWith("/")) {
    re = re.replace(/\/$/, "(/|$)");
  }

  return new RegExp(re);
}

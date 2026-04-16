import type { Issue } from "../types";
import { Glob } from "bun";
import { loadIgnorePatterns, isFileIgnored } from "../ignore";

const SKIP_PATH = /node_modules|\.git\/|\/dist\/|\/build\/|\.min\.|\/coverage\/|\/out\/|\/env\/|\/vendor\/|\/\.next\/|\/public\/.*assets\//;

// Thresholds from research: soft warn at 500 LOC, hard at 800
const SOFT_LIMIT = 500;
const HARD_LIMIT = 800;
const GOD_FILE_LIMIT = 1200;

// Function length (already in grep, but file-level gives better context)
const FUNC_SOFT_LIMIT = 50;

export async function runFileMetrics(targetPath: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  const ignorePatterns = await loadIgnorePatterns(targetPath);
  const glob = new Glob("**/*.{ts,tsx,js,jsx,py,rs,go,java,kt,rb,swift}");

  for await (const filePath of glob.scan({
    cwd: targetPath,
    absolute: true,
    dot: false,
  })) {
    if (SKIP_PATH.test(filePath)) continue;
    if (isFileIgnored(filePath, targetPath, ignorePatterns)) continue;

    try {
      const content = await Bun.file(filePath).text();
      const lines = content.split("\n");
      const loc = lines.filter((l) => l.trim() && !l.trim().startsWith("//") && !l.trim().startsWith("#")).length;

      // Skip generated/auto-generated files for LOC checks
      const isGenFile = /\.gen\.|\.generated\.|payload-types|\.d\.ts$/.test(filePath);

      // GOD_FILE: file exceeds hard limit
      if (loc >= GOD_FILE_LIMIT && !isGenFile) {
        issues.push({
          id: "GOD_FILE",
          category: "complexity",
          severity: "CRITICAL",
          tier: 0,
          file: filePath,
          line: 1,
          message: `File has ${loc} lines of code — split into domain modules (threshold: ${GOD_FILE_LIMIT})`,
          tool: "file-metrics",
        });
      } else if (loc >= HARD_LIMIT && !isGenFile) {
        issues.push({
          id: "LARGE_FILE",
          category: "complexity",
          severity: "HIGH",
          tier: 0,
          file: filePath,
          line: 1,
          message: `File has ${loc} lines of code — approaching god file territory (threshold: ${HARD_LIMIT})`,
          tool: "file-metrics",
        });
      } else if (loc >= SOFT_LIMIT && !isGenFile) {
        issues.push({
          id: "LONG_FILE",
          category: "complexity",
          severity: "MEDIUM",
          tier: 0,
          file: filePath,
          line: 1,
          message: `File has ${loc} lines of code — consider splitting (threshold: ${SOFT_LIMIT})`,
          tool: "file-metrics",
        });
      }

      // BARREL_EXPORT: file is mostly re-exports (export * or export { })
      const barrelExports = lines.filter((l) =>
        /^\s*export\s+\*\s+from\s+/.test(l) || /^\s*export\s+\{[^}]+\}\s+from\s+/.test(l)
      ).length;
      const totalExports = lines.filter((l) => /^\s*export\s/.test(l)).length;

      if (totalExports > 3 && barrelExports / totalExports > 0.7) {
        issues.push({
          id: "BARREL_FILE",
          category: "complexity",
          severity: "MEDIUM",
          tier: 0,
          file: filePath,
          line: 1,
          message: `Barrel export file — ${barrelExports}/${totalExports} exports are re-exports. Direct imports are faster (Atlassian: 75% build speed gain)`,
          tool: "file-metrics",
        });
      }

      // STAR_REEXPORT: export * from (always bad — pollutes namespace)
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*export\s+\*\s+from\s+/.test(lines[i])) {
          issues.push({
            id: "STAR_REEXPORT",
            category: "inconsistency",
            severity: "HIGH",
            tier: 0,
            file: filePath,
            line: i + 1,
            message: "export * from — pollutes namespace, hides what's exposed. Use named exports.",
            tool: "file-metrics",
          });
        }
      }

      // MIXED_CONCERNS: file has both route/controller AND direct DB access
      const isTestFile = /\.(test|spec|int\.test)\.(ts|tsx|js|jsx|py)$|__tests__|tests\//.test(filePath);
      const isScript = /\/scripts\/|\/seeds?\/|\.seed\.|\.migration\./.test(filePath);
      const hasRoute = lines.some((l) =>
        /router\.(get|post|put|patch|delete)\s*\(/.test(l) ||
        /app\.(get|post|put|patch|delete)\s*\(/.test(l) ||
        /@(Get|Post|Put|Patch|Delete)\(/.test(l) ||
        /export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/.test(l) ||
        /procedure\s*\(\s*\)/.test(l)
      );
      const hasDbQuery = lines.some((l) =>
        /prisma\.\w+\.(find|create|update|delete|upsert|count|aggregate)/.test(l) ||
        /\.query\s*\(/.test(l) ||
        /session\.(execute|query|scalar)/.test(l) ||
        /\bdb\.\w+\.(find|insert|update|delete|select)/.test(l)
      );
      if (hasRoute && hasDbQuery && loc > 100 && !isTestFile && !isScript) {
        issues.push({
          id: "MIXED_CONCERNS",
          category: "complexity",
          severity: "HIGH",
          tier: 0,
          file: filePath,
          line: 1,
          message: "Route handler contains direct DB queries — extract to service/repository layer",
          tool: "file-metrics",
        });
      }

      // SINGLE_FILE_APP: file has imports from 10+ different modules (kitchen sink)
      const importPaths = new Set<string>();
      for (const line of lines) {
        const match = line.match(/(?:import|from)\s+["']([^"']+)["']/);
        if (match) importPaths.add(match[1]);
      }
      const isGenerated = /\.gen\.|\.generated\.|payload\.config|payload-types/.test(filePath);
      if (importPaths.size >= 15 && !isGenerated) {
        issues.push({
          id: "IMPORT_HEAVY",
          category: "complexity",
          severity: "MEDIUM",
          tier: 0,
          file: filePath,
          line: 1,
          message: `File imports from ${importPaths.size} modules — too many concerns in one file`,
          tool: "file-metrics",
        });
      }

      // MONOLITH_ROUTE: single route file handling 5+ HTTP methods (should be split VSA-style)
      const httpMethods = new Set<string>();
      for (const line of lines) {
        const match = line.match(/\.(get|post|put|patch|delete)\s*\(/i);
        if (match) httpMethods.add(match[1].toLowerCase());
      }
      if (httpMethods.size >= 4) {
        issues.push({
          id: "MONOLITH_ROUTE",
          category: "complexity",
          severity: "MEDIUM",
          tier: 0,
          file: filePath,
          line: 1,
          message: `Route file handles ${httpMethods.size} HTTP methods — split into one file per endpoint (VSA)`,
          tool: "file-metrics",
        });
      }

    } catch {
      // Unreadable file, skip
    }
  }

  return issues;
}

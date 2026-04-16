import type { Issue } from "../types";
import type { FileEntry } from "./file-walker";

// Thresholds from research: soft warn at 500 LOC, hard at 800
const SOFT_LIMIT = 500;
const HARD_LIMIT = 800;
const GOD_FILE_LIMIT = 1200;

export function runFileMetricsFromEntries(entries: FileEntry[]): Issue[] {
  const issues: Issue[] = [];

  for (const entry of entries) {
    const filePath = entry.path;
    const lines = entry.lines;
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

      // GENERIC_BUCKET_FILE: utils.ts, helpers.ts, misc.ts with 10+ exports
      const fileName = filePath.split("/").pop() ?? "";
      if (/^(utils|helpers|misc|common|shared|lib)\.(ts|tsx|js|jsx|py)$/.test(fileName) && loc > 100) {
        issues.push({
          id: "GENERIC_BUCKET_FILE",
          category: "naming-semantics",
          severity: "MEDIUM",
          tier: 0,
          file: filePath,
          line: 1,
          message: `Generic bucket file "${fileName}" with ${loc} lines — split into domain-specific modules`,
          tool: "file-metrics",
        });
      }

      // DEBUG_VARIANT_FILE: files with _v2, _old, _backup, _copy suffixes
      if (/_v\d+|_old|_new|_backup|_copy|_fixed|_temp|_bak|_draft/.test(fileName)) {
        issues.push({
          id: "DEBUG_VARIANT_FILE",
          category: "ai-slop",
          severity: "MEDIUM",
          tier: 0,
          file: filePath,
          line: 1,
          message: `Debug variant file "${fileName}" — delete or rename (git has history)`,
          tool: "file-metrics",
        });
      }

      // SCATTERED_ENV: process.env in non-config files
      const isConfigFile = /config\.|settings\.|env\.|\.env/.test(filePath);
      if (!isConfigFile && !isTestFile) {
        let envCount = 0;
        for (const line of lines) {
          if (/process\.env\.\w+/.test(line)) envCount++;
        }
        if (envCount >= 3) {
          issues.push({
            id: "SCATTERED_ENV",
            category: "inconsistency",
            severity: "MEDIUM",
            tier: 0,
            file: filePath,
            line: 1,
            message: `${envCount} direct process.env accesses — centralize in a config module`,
            tool: "file-metrics",
          });
        }
      }

      // MANY_USESTATE: React component with 6+ useState calls
      if (/\.(tsx|jsx)$/.test(filePath)) {
        let useStateCount = 0;
        for (const line of lines) {
          if (/\buseState\s*[<(]/.test(line)) useStateCount++;
        }
        if (useStateCount >= 6) {
          issues.push({
            id: "MANY_USESTATE",
            category: "complexity",
            severity: "MEDIUM",
            tier: 0,
            file: filePath,
            line: 1,
            message: `${useStateCount} useState calls — consider useReducer or splitting the component`,
            tool: "file-metrics",
          });
        }
      }

      // VERB_IN_ROUTE: REST routes with verbs in the URL path
      for (let i = 0; i < lines.length; i++) {
        const routeMatch = lines[i].match(/\.(get|post|put|patch|delete)\s*\(\s*["'`]\/[^"'`]*\b(create|get|fetch|update|delete|remove|process|handle|retrieve|list)\w*["'`]/i);
        if (routeMatch) {
          issues.push({
            id: "VERB_IN_ROUTE",
            category: "inconsistency",
            severity: "LOW",
            tier: 0,
            file: filePath,
            line: i + 1,
            message: "Verb in REST route path — HTTP method is already the verb. Use nouns only.",
            tool: "file-metrics",
          });
        }
      }

  }

  return issues;
}

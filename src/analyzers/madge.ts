import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Issue } from "../types";
import { resolveToolCommand } from "../tool-command";
import { externalDeltaIdentity, externalSuccess, externalWarning, type ExternalAnalyzerResult } from "./external-result";

export function getMadgeTargets(targetPath: string): string[] {
  const packageJsonPath = join(targetPath, "package.json");
  if (!existsSync(packageJsonPath)) return [targetPath];

  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { workspaces?: unknown };
    const workspaces = Array.isArray(pkg.workspaces) ? pkg.workspaces.filter((value): value is string => typeof value === "string") : [];
    const targets = workspaces.flatMap((pattern) => expandWorkspacePattern(targetPath, pattern));
    return targets.length > 0 ? targets : [targetPath];
  } catch {
    return [targetPath];
  }
}

function expandWorkspacePattern(rootPath: string, pattern: string): string[] {
  if (!pattern.endsWith("/*")) return [];

  const baseDir = join(rootPath, pattern.slice(0, -2));
  if (!existsSync(baseDir)) return [];

  return readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(pattern.slice(0, -2), entry.name))
    .filter((candidate) => existsSync(join(rootPath, candidate, "package.json")));
}

function parseMadgeCycles(stdout: string): string[][] | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(stdout);
  } catch {
    parsed = null;
  }

  if (!Array.isArray(parsed)) return null;
  return parsed.filter((cycle): cycle is string[] => Array.isArray(cycle) && cycle.every((segment) => typeof segment === "string"));
}

function buildIssue(scopePath: string, cycle: string[]): Issue {
  const file = resolve(scopePath, cycle[0] ?? "");
  const cyclePaths = cycle.map((segment) => resolve(scopePath, segment));
  const cycleStr = cyclePaths.join(" → ") + " → " + cyclePaths[0];
  return {
    id: "CIRCULAR_IMPORT",
    category: "circular-deps",
    severity: "HIGH",
    tier: 3,
    file,
    line: 0,
    message: `Circular dependency: ${cycleStr}`,
    fix: "Extract shared types or use dependency inversion",
    tool: "madge",
    deltaIdentity: externalDeltaIdentity("cycle", ...cycle),
  };
}

export async function runMadge(targetPath: string): Promise<ExternalAnalyzerResult> {
  const madgeCmd = resolveToolCommand(targetPath, "madge");
  const issues: Issue[] = [];
  const seen = new Set<string>();
  const warnings: string[] = [];

  for (const scopePath of getMadgeTargets(targetPath)) {
    const result = Bun.spawnSync(
      [
        madgeCmd,
        "--circular",
        "--extensions", "ts,tsx,js,jsx",
        "--json",
        scopePath,
      ],
      { cwd: targetPath, stdout: "pipe", stderr: "pipe", timeout: 60_000 }
    );

    if (result.exitCode !== 0 && result.exitCode !== 1) {
      const warning = externalWarning("madge", `command exited with code ${result.exitCode ?? 1} for ${scopePath}`, result.stderr.toString()).warning;
      if (warning) warnings.push(warning);
      continue;
    }

    const stdout = result.stdout.toString().trim();
    if (!stdout) continue;

    const cycles = parseMadgeCycles(stdout);
    if (!cycles) {
      const warning = externalWarning("madge", `failed to parse JSON output for ${scopePath}`, result.stderr.toString()).warning;
      if (warning) warnings.push(warning);
      continue;
    }

    for (const cycle of cycles) {
      if (cycle.length === 0) continue;
      const issue = buildIssue(scopePath, cycle);
      const key = `${issue.file}|${issue.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push(issue);
    }
  }

  return warnings.length > 0 ? { issues, warning: warnings.join("\n") } : externalSuccess(issues);
}

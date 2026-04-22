import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Issue } from "../types";
import { resolveToolCommand } from "../tool-command";
import { externalDeltaIdentity, externalSuccess, externalWarning, type ExternalAnalyzerResult } from "./external-result";

interface KnipLocation {
  name?: string;
  line?: number;
}

interface KnipIssueGroup {
  file?: string;
  files?: KnipLocation[];
  exports?: KnipLocation[];
  types?: KnipLocation[];
  dependencies?: KnipLocation[];
  devDependencies?: KnipLocation[];
  unlisted?: KnipLocation[];
}

interface LegacyKnipReport {
  files?: Array<string | { name?: string }>;
  exports?: Record<string, Array<{ name: string; line?: number }>>;
  dependencies?: Record<string, unknown>;
  unlisted?: Record<string, string[]>;
}

function getKnipEnv(targetPath: string): Record<string, string> {
  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );

  if (!env.DATABASE_URL && hasDrizzleConfig(targetPath)) {
    env.DATABASE_URL = "postgresql://localhost:5432/placeholder";
  }

  return env;
}

function hasDrizzleConfig(targetPath: string): boolean {
  return ["drizzle.config.ts", "drizzle.config.js", "drizzle.config.mjs", "drizzle.config.cjs"].some((file) => existsSync(join(targetPath, file)));
}

function getKnipWorkspaceTargets(targetPath: string): string[] {
  const packageJsonPath = join(targetPath, "package.json");
  if (!existsSync(packageJsonPath)) return [];

  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { workspaces?: unknown };
    const workspaces = Array.isArray(pkg.workspaces) ? pkg.workspaces.filter((value): value is string => typeof value === "string") : [];
    return workspaces.flatMap((pattern) => expandWorkspacePattern(targetPath, pattern));
  } catch {
    return [];
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

function buildKnipIdentity(kind: string, name: string): string {
  return externalDeltaIdentity(kind, name) ?? `${kind}:${name}`;
}

function parseLegacyKnipReport(data: LegacyKnipReport): Issue[] {
  const issues: Issue[] = [];

  if (data.files) {
    for (const file of data.files) {
      const fileName = typeof file === "string" ? file : file.name ?? "unknown";
      issues.push({
        id: "DEAD_FILE",
        category: "dead-code",
        severity: "HIGH",
        tier: 3,
        file: fileName,
        line: 0,
        message: "Unused file — not imported anywhere",
        fix: "Remove the file",
        tool: "knip",
        deltaIdentity: buildKnipIdentity("file", fileName),
      });
    }
  }

  if (data.exports) {
    for (const [file, exports] of Object.entries(data.exports)) {
      for (const exp of exports) {
        issues.push({
          id: "DEAD_EXPORT",
          category: "dead-code",
          severity: "HIGH",
          tier: 3,
          file,
          line: exp.line ?? 0,
          message: `Unused export: ${exp.name}`,
          fix: `Remove export '${exp.name}' — no importers found`,
          tool: "knip",
          deltaIdentity: buildKnipIdentity("export", exp.name),
        });
      }
    }
  }

  if (data.dependencies) {
    for (const pkg of Object.keys(data.dependencies)) {
      issues.push({
        id: "DEAD_DEPENDENCY",
        category: "dead-code",
        severity: "MEDIUM",
        tier: 3,
        file: "package.json",
        line: 0,
        message: `Unused dependency: ${pkg}`,
        fix: `Remove '${pkg}' from dependencies`,
        tool: "knip",
        deltaIdentity: buildKnipIdentity("dependency", pkg),
      });
    }
  }

  if (data.unlisted) {
    for (const [file, deps] of Object.entries(data.unlisted)) {
      for (const dep of deps) {
        issues.push({
          id: "UNLISTED_DEPENDENCY",
          category: "inconsistency",
          severity: "MEDIUM",
          tier: 0,
          file,
          line: 0,
          message: `Unlisted dependency: ${dep}`,
          tool: "knip",
          deltaIdentity: buildKnipIdentity("unlisted", dep),
        });
      }
    }
  }

  return issues;
}

function parseModernKnipReport(data: { issues?: KnipIssueGroup[] }): Issue[] {
  const issues: Issue[] = [];

  for (const group of data.issues ?? []) {
    for (const file of group.files ?? []) {
      const fileName = file.name ?? group.file ?? "unknown";
      issues.push({
        id: "DEAD_FILE",
        category: "dead-code",
        severity: "HIGH",
        tier: 3,
        file: fileName,
        line: file.line ?? 0,
        message: "Unused file — not imported anywhere",
        fix: "Remove the file",
        tool: "knip",
        deltaIdentity: buildKnipIdentity("file", fileName),
      });
    }

    for (const exp of group.exports ?? []) {
      issues.push({
        id: "DEAD_EXPORT",
        category: "dead-code",
        severity: "HIGH",
        tier: 3,
        file: group.file ?? "unknown",
        line: exp.line ?? 0,
        message: `Unused export: ${exp.name}`,
        fix: `Remove export '${exp.name}' — no importers found`,
        tool: "knip",
        deltaIdentity: buildKnipIdentity("export", exp.name ?? "unknown"),
      });
    }

    for (const type of group.types ?? []) {
      issues.push({
        id: "DEAD_EXPORT",
        category: "dead-code",
        severity: "HIGH",
        tier: 3,
        file: group.file ?? "unknown",
        line: type.line ?? 0,
        message: `Unused type export: ${type.name}`,
        fix: `Remove type export '${type.name}' — no importers found`,
        tool: "knip",
        deltaIdentity: buildKnipIdentity("type-export", type.name ?? "unknown"),
      });
    }

    for (const dep of [...(group.dependencies ?? []), ...(group.devDependencies ?? [])]) {
      issues.push({
        id: "DEAD_DEPENDENCY",
        category: "dead-code",
        severity: "MEDIUM",
        tier: 3,
        file: group.file ?? "package.json",
        line: dep.line ?? 0,
        message: `Unused dependency: ${dep.name}`,
        fix: `Remove '${dep.name}' from dependencies`,
        tool: "knip",
        deltaIdentity: buildKnipIdentity("dependency", dep.name ?? "unknown"),
      });
    }

    for (const dep of group.unlisted ?? []) {
      issues.push({
        id: "UNLISTED_DEPENDENCY",
        category: "inconsistency",
        severity: "MEDIUM",
        tier: 0,
        file: group.file ?? "unknown",
        line: dep.line ?? 0,
        message: `Unlisted dependency: ${dep.name}`,
        tool: "knip",
        deltaIdentity: buildKnipIdentity("unlisted", dep.name ?? "unknown"),
      });
    }
  }

  return issues;
}

function isKnipReport(value: unknown): value is LegacyKnipReport & { issues?: KnipIssueGroup[] } {
  return typeof value === "object" && value !== null;
}

export function parseKnipReport(stdout: string): Issue[] {
  const data = JSON.parse(stdout);
  if (!isKnipReport(data)) return [];
  if (Array.isArray(data.issues)) return parseModernKnipReport(data);
  return parseLegacyKnipReport(data);
}

function runKnipCommand(targetPath: string, args: string[]): ExternalAnalyzerResult {
  const result = Bun.spawnSync(args, {
    cwd: targetPath,
    env: getKnipEnv(targetPath),
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120_000,
  });

  if (result.exitCode !== 0 && result.exitCode !== 1) {
    return externalWarning("knip", `command exited with code ${result.exitCode ?? 1}`, result.stderr.toString());
  }

  const stdout = result.stdout.toString().trim();
  if (!stdout) {
    return result.exitCode === 1
      ? externalWarning("knip", "reported issues but produced no JSON output", result.stderr.toString())
      : externalSuccess([]);
  }

  try {
    return externalSuccess(parseKnipReport(stdout));
  } catch {
    return externalWarning("knip", "failed to parse JSON output", result.stderr.toString());
  }
}

export async function runKnip(targetPath: string): Promise<ExternalAnalyzerResult> {
  const knipCmd = resolveToolCommand(targetPath, "knip");
  const directResult = runKnipCommand(targetPath, [knipCmd, "--reporter", "json", "--no-progress"]);

  if (directResult.issues.length > 0 || !directResult.warning) {
    return directResult;
  }

  const workspaceTargets = getKnipWorkspaceTargets(targetPath);
  if (workspaceTargets.length === 0) return directResult;

  const issues: Issue[] = [];
  const warnings: string[] = [directResult.warning];
  for (const workspace of workspaceTargets) {
    const result = runKnipCommand(targetPath, [knipCmd, "--reporter", "json", "--no-progress", "--workspace", workspace]);
    issues.push(...result.issues);
    if (result.warning) warnings.push(`${result.warning} [workspace=${workspace}]`);
  }

  return warnings.length > 0 ? { issues, warning: warnings.join("\n") } : externalSuccess(issues);
}

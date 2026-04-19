import { existsSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import type { Issue, Severity } from "./types";

export interface RuleOverride {
  enabled?: boolean;
  severity?: Severity;
  weight?: number;
}

export interface FileOverride {
  files: string[];
  rules?: Record<string, RuleOverride>;
}

export interface DesloppifyConfig {
  rules?: Record<string, RuleOverride>;
  overrides?: FileOverride[];
}

export interface LoadedDesloppifyConfig {
  path: string | null;
  config: DesloppifyConfig;
}

const CONFIG_FILENAMES = [
  "desloppify.config.json",
  ".desloppifyrc",
  ".desloppifyrc.json",
] as const;

export function loadDesloppifyConfig(rootPath: string): LoadedDesloppifyConfig {
  for (const filename of CONFIG_FILENAMES) {
    const configPath = resolve(rootPath, filename);
    if (!existsSync(configPath)) continue;
    const raw = JSON.parse(readFileSync(configPath, "utf8")) as DesloppifyConfig;
    return { path: configPath, config: raw };
  }

  return { path: null, config: {} };
}

export function getRuleOverride(config: DesloppifyConfig, ruleId: string): RuleOverride | undefined {
  return config.rules?.[ruleId];
}

function getOverrideForIssue(config: DesloppifyConfig, ruleId: string, filePath: string, rootPath: string): RuleOverride | undefined {
  const merged: RuleOverride = { ...(config.rules?.[ruleId] ?? {}) };
  const relativePath = toRelativeConfigPath(filePath, rootPath);

  for (const override of config.overrides ?? []) {
    if (!override.rules?.[ruleId]) continue;
    if (!override.files.some((pattern) => matchesConfigGlob(relativePath, pattern))) continue;
    Object.assign(merged, override.rules[ruleId]);
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

export function isRuleEnabled(config: DesloppifyConfig, ruleId: string): boolean {
  return getRuleOverride(config, ruleId)?.enabled !== false;
}

export function applyConfigToIssues(issues: Issue[], config: DesloppifyConfig, rootPath: string): Issue[] {
  return issues.flatMap((issue) => {
    const override = getOverrideForIssue(config, issue.id, issue.file, rootPath) ?? getRuleOverride(config, issue.id);
    if (override?.enabled === false) return [];

    return [{
      ...issue,
      severity: override?.severity ?? issue.severity,
      scoreWeight: override?.weight ?? issue.scoreWeight,
    }];
  });
}

function toRelativeConfigPath(filePath: string, rootPath: string): string {
  const rel = relative(rootPath, filePath);
  return (rel.startsWith("..") ? filePath : rel).split(sep).join("/");
}

function matchesConfigGlob(path: string, pattern: string): boolean {
  if (!pattern.includes("*")) return path === pattern || path.endsWith(`/${pattern}`) || path.includes(pattern);
  const doubleStarToken = "__DESLOPPIFY_DOUBLE_STAR__";
  const escaped = pattern
    .replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
    .replace(/\*\*/g, doubleStarToken)
    .replace(/\*/g, "[^/]*")
    .replaceAll(doubleStarToken, ".*");
  return new RegExp(`^${escaped}$`).test(path);
}

export function getRuleScoreWeight(config: DesloppifyConfig, ruleId: string): number | undefined {
  return getRuleOverride(config, ruleId)?.weight;
}

export function getRuleSeverityOverride(config: DesloppifyConfig, ruleId: string): Severity | undefined {
  return getRuleOverride(config, ruleId)?.severity;
}

export function getConfigExample(): string {
  return JSON.stringify({
    rules: {
      CONSOLE_LOG: { enabled: false },
      LONG_FILE: { severity: "HIGH", weight: 1.5 },
    },
    overrides: [
      {
        files: ["src/rules/**"],
        rules: {
          LONG_FILE: { enabled: false },
        },
      },
    ],
  }, null, 2);
}

import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { resolvePluginConfigExtends } from "./plugin-rules";
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
  extends?: string[];
  plugins?: Record<string, string>;
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
    return { path: configPath, config: loadConfigFile(configPath) };
  }

  return { path: null, config: {} };
}

function loadConfigFile(configPath: string, seen = new Set<string>()): DesloppifyConfig {
  const resolvedPath = resolve(configPath);
  if (seen.has(resolvedPath)) {
    throw new Error(`Config extends cycle detected: ${resolvedPath}`);
  }

  seen.add(resolvedPath);
  const raw = JSON.parse(readFileSync(resolvedPath, "utf8")) as DesloppifyConfig;
  let merged: DesloppifyConfig = {};

  for (const ref of raw.extends ?? []) {
    if (ref.startsWith("plugin:")) continue;
    const extendedPath = resolve(dirname(resolvedPath), ref);
    if (!existsSync(extendedPath)) {
      throw new Error(`Cannot resolve config extends target: ${ref}`);
    }
    merged = mergeConfigs(merged, loadConfigFile(extendedPath, seen));
  }

  const combined = mergeConfigs(merged, { plugins: raw.plugins });
  const pluginExtends = resolvePluginConfigExtends(raw.extends, combined, dirname(resolvedPath));

  seen.delete(resolvedPath);
  return mergeConfigs(mergeConfigs(merged, pluginExtends), { ...raw, extends: undefined });
}

function mergeConfigs(base: DesloppifyConfig, next: DesloppifyConfig): DesloppifyConfig {
  return {
    plugins: {
      ...(base.plugins ?? {}),
      ...(next.plugins ?? {}),
    },
    rules: {
      ...(base.rules ?? {}),
      ...(next.rules ?? {}),
    },
    overrides: [
      ...(base.overrides ?? []),
      ...(next.overrides ?? []),
    ],
  };
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

export function getRuleScoreWeight(config: DesloppifyConfig, ruleId: string): number | undefined {
  return getRuleOverride(config, ruleId)?.weight;
}

export function getRuleSeverityOverride(config: DesloppifyConfig, ruleId: string): Severity | undefined {
  return getRuleOverride(config, ruleId)?.severity;
}

export function getConfigExample(): string {
  return JSON.stringify({
    extends: ["./desloppify.base.json"],
    plugins: {
      local: "./desloppify.plugin.json",
    },
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

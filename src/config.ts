import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { matchesConfigGlob } from "./config-glob";
import { resolvePluginConfigExtends } from "./plugin-loader";
import type { DesloppifyConfig, LoadedDesloppifyConfig, PluginRuleOptions, RuleOverride } from "./config-types";
import type { Issue, Severity } from "./types";

const CONFIG_FILENAMES = [
  "desloppify.config.json",
  "desloppify.config.cjs",
  "desloppify.config.js",
  ".desloppifyrc",
  ".desloppifyrc.json",
  ".desloppifyrc.cjs",
  ".desloppifyrc.js",
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
  const raw = loadConfigValue(resolvedPath);
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

function loadConfigValue(configPath: string): DesloppifyConfig {
  if (extname(configPath) === ".json" || !extname(configPath)) {
    return JSON.parse(readFileSync(configPath, "utf8")) as DesloppifyConfig;
  }

  const requireConfig = createRequire(configPath);
  const loaded = requireConfig(configPath) as DesloppifyConfig | { default?: DesloppifyConfig };
  const config = (loaded as { default?: DesloppifyConfig }).default ?? loaded;
  return config as DesloppifyConfig;
}

function mergeRecord<T>(base: Record<string, T> | undefined, next: Record<string, T> | undefined): Record<string, T> | undefined {
  if (!base) return next ? { ...next } : undefined;
  if (!next) return { ...base };
  return {
    ...base,
    ...next,
  };
}

function mergeList<T>(base: T[] | undefined, next: T[] | undefined): T[] | undefined {
  if (!base) return next ? [...next] : undefined;
  if (!next) return [...base];
  return [...base, ...next];
}

function cloneOptions(options: PluginRuleOptions | undefined): PluginRuleOptions | undefined {
  return options ? { ...options } : undefined;
}

function mergeOptions(base: PluginRuleOptions | undefined, next: PluginRuleOptions | undefined): PluginRuleOptions | undefined {
  if (!base) return cloneOptions(next);
  if (!next) return cloneOptions(base);
  return {
    ...base,
    ...next,
  };
}

function cloneRuleOverride(override: RuleOverride): RuleOverride {
  return {
    ...override,
    options: cloneOptions(override.options),
  };
}

function mergeRuleOverride(base: RuleOverride | undefined, next: RuleOverride | undefined): RuleOverride | undefined {
  if (!base) return next ? cloneRuleOverride(next) : undefined;
  if (!next) return cloneRuleOverride(base);
  return {
    ...base,
    ...next,
    options: mergeOptions(base.options, next.options),
  };
}

function mergeRuleOverrides(
  base: Record<string, RuleOverride> | undefined,
  next: Record<string, RuleOverride> | undefined,
): Record<string, RuleOverride> | undefined {
  if (!base) {
    return next
      ? Object.fromEntries(Object.entries(next).map(([ruleId, override]) => [ruleId, cloneRuleOverride(override)]))
      : undefined;
  }
  if (!next) {
    return Object.fromEntries(Object.entries(base).map(([ruleId, override]) => [ruleId, cloneRuleOverride(override)]));
  }

  const merged = Object.fromEntries(Object.entries(base).map(([ruleId, override]) => [ruleId, cloneRuleOverride(override)]));
  for (const [ruleId, override] of Object.entries(next)) {
    merged[ruleId] = mergeRuleOverride(merged[ruleId], override) ?? cloneRuleOverride(override);
  }
  return merged;
}

function mergeConfigs(base: DesloppifyConfig, next: DesloppifyConfig): DesloppifyConfig {
  return {
    plugins: mergeRecord(base.plugins, next.plugins),
    rules: mergeRuleOverrides(base.rules, next.rules),
    overrides: mergeList(base.overrides, next.overrides),
  };
}

function getTopLevelRuleOverride(config: DesloppifyConfig, ruleId: string): RuleOverride | undefined {
  return config.rules?.[ruleId];
}

export function resolveRuleOverride(config: DesloppifyConfig, ruleId: string, filePath: string, rootPath: string): RuleOverride | undefined {
  let merged = mergeRuleOverride(undefined, getTopLevelRuleOverride(config, ruleId));
  const relativePath = toRelativeConfigPath(filePath, rootPath);

  for (const override of config.overrides ?? []) {
    if (!override.rules?.[ruleId]) continue;
    if (!override.files.some((pattern) => matchesConfigGlob(relativePath, pattern))) continue;
    merged = mergeRuleOverride(merged, override.rules[ruleId]);
  }

  return merged;
}

export function isRuleEnabled(config: DesloppifyConfig, ruleId: string): boolean {
  return getTopLevelRuleOverride(config, ruleId)?.enabled !== false;
}

export function applyConfigToIssues(issues: Issue[], config: DesloppifyConfig, rootPath: string): Issue[] {
  return issues.flatMap((issue) => {
    const override = resolveRuleOverride(config, issue.id, issue.file, rootPath);
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

export function getRuleScoreWeight(config: DesloppifyConfig, ruleId: string): number | undefined {
  return getTopLevelRuleOverride(config, ruleId)?.weight;
}

export function getRuleSeverityOverride(config: DesloppifyConfig, ruleId: string): Severity | undefined {
  return getTopLevelRuleOverride(config, ruleId)?.severity;
}

export function getConfigExample(): string {
  return JSON.stringify({
    extends: ["./desloppify.base.json", "plugin:local/recommended"],
    plugins: {
      local: "./desloppify.plugin.cjs",
    },
    rules: {
      CONSOLE_LOG: { enabled: false },
      LONG_FILE: { severity: "HIGH", weight: 1.5 },
      "local/contains-acme": { options: { token: "ACME" } },
    },
    overrides: [
      {
        files: ["src/rules/**"],
        rules: {
          LONG_FILE: { enabled: false },
          "local/contains-acme": { options: { token: "RULE_TEST_TOKEN" } },
        },
      },
    ],
  }, null, 2);
}

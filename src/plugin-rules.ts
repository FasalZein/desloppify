import { relative, sep } from "node:path";
import type { FileEntry } from "./analyzers/file-walker";
import { matchesConfigGlob } from "./config-glob";
import { resolveRuleOverride } from "./config";
import type { DesloppifyConfig, PluginRuleOptionValue, PluginRuleOptions } from "./config-types";
import { loadConfiguredPlugins } from "./plugin-loader";
import type { DesloppifyPluginRuleOptionSpec } from "./plugin-api";
import type { Category, Issue, Severity } from "./types";
import type { RuleCatalogEntry } from "./rule-catalog";

export interface LoadedPluginRule {
  id: string;
  category: Category;
  severity: Severity;
  description: string;
  patternTemplate: string;
  messageTemplate: string;
  fixTemplate?: string;
  flagsTemplate: string;
  fileTemplates: string[];
  tier: number;
  tool: string;
  identityGroup: number;
  optionSpecs: Record<string, DesloppifyPluginRuleOptionSpec>;
  defaultOptions: PluginRuleOptions;
}

export { loadConfiguredPlugins, resolvePluginConfigExtends } from "./plugin-loader";

export function loadConfigPluginRules(config: DesloppifyConfig, rootPath: string): LoadedPluginRule[] {
  const loaded: LoadedPluginRule[] = [];

  for (const { namespace, plugin } of loadConfiguredPlugins(config, rootPath)) {
    for (const rule of plugin.rules ?? []) {
      const id = `${namespace}/${rule.id}`;
      const optionSpecs = rule.options ? { ...rule.options } : {};
      validateConfiguredOptions(id, optionSpecs, config.rules?.[id]?.options, "rules");

      for (const override of config.overrides ?? []) {
        validateConfiguredOptions(id, optionSpecs, override.rules?.[id]?.options, "overrides");
      }

      const defaultOptions = getDefaultRuleOptions(optionSpecs);
      const baseOptions = mergeOptionValues(defaultOptions, config.rules?.[id]?.options);
      loaded.push({
        id,
        category: rule.category,
        severity: rule.severity,
        description: renderTemplate(rule.description ?? rule.message, baseOptions, id, "description"),
        patternTemplate: rule.pattern,
        messageTemplate: rule.message,
        fixTemplate: rule.fix,
        flagsTemplate: rule.flags ?? "",
        fileTemplates: rule.files ?? ["**/*"],
        tier: rule.tier ?? 0,
        tool: `plugin:${namespace}`,
        identityGroup: rule.identityGroup ?? 0,
        optionSpecs,
        defaultOptions,
      });
    }
  }

  return loaded;
}

export function getConfigPluginRuleCatalog(rules: LoadedPluginRule[]): RuleCatalogEntry[] {
  return rules.map((rule) => ({
    id: rule.id,
    category: rule.category,
    tier: rule.tier,
    tool: rule.tool,
    desc: rule.description,
  }));
}

export function runConfigPluginRules(
  entries: FileEntry[],
  rules: LoadedPluginRule[],
  config: DesloppifyConfig,
  rootPath: string,
): Issue[] {
  const issues: Issue[] = [];

  for (const entry of entries) {
    const relativePath = toRelativePath(entry.path, rootPath);
    for (const rule of rules) {
      const override = resolveRuleOverride(config, rule.id, entry.path, rootPath);
      if (override?.enabled === false) continue;

      const options = mergeOptionValues(rule.defaultOptions, override?.options);
      const files = rule.fileTemplates.map((pattern) => renderTemplate(pattern, options, rule.id, "files"));
      if (!files.some((pattern) => matchesConfigGlob(relativePath, pattern))) continue;

      const regex = new RegExp(
        renderTemplate(rule.patternTemplate, options, rule.id, "pattern"),
        renderTemplate(rule.flagsTemplate, options, rule.id, "flags"),
      );
      const message = renderTemplate(rule.messageTemplate, options, rule.id, "message");
      const fix = rule.fixTemplate
        ? renderTemplate(rule.fixTemplate, options, rule.id, "fix")
        : undefined;

      for (let index = 0; index < entry.lines.length; index += 1) {
        const line = entry.lines[index] ?? "";
        for (const match of getLineMatches(regex, line)) {
          issues.push({
            id: rule.id,
            category: rule.category,
            severity: override?.severity ?? rule.severity,
            tier: rule.tier as 0 | 1 | 2 | 3,
            file: entry.path,
            line: index + 1,
            message,
            tool: rule.tool,
            fix,
            deltaIdentity: normalizeDeltaIdentity(match[rule.identityGroup] ?? match[0]),
          });
        }
      }
    }
  }

  return issues;
}

function getDefaultRuleOptions(optionSpecs: Record<string, DesloppifyPluginRuleOptionSpec>): PluginRuleOptions {
  const defaults: PluginRuleOptions = {};

  for (const [optionName, optionSpec] of Object.entries(optionSpecs)) {
    if (optionSpec.default === undefined) continue;
    defaults[optionName] = optionSpec.default;
  }

  return defaults;
}

function mergeOptionValues(base: PluginRuleOptions, next: PluginRuleOptions | undefined): PluginRuleOptions {
  if (!next) return { ...base };
  return {
    ...base,
    ...next,
  };
}

function validateConfiguredOptions(
  ruleId: string,
  optionSpecs: Record<string, DesloppifyPluginRuleOptionSpec>,
  configuredOptions: PluginRuleOptions | undefined,
  source: "rules" | "overrides",
): void {
  if (!configuredOptions) return;

  for (const [optionName, optionValue] of Object.entries(configuredOptions)) {
    const optionSpec = optionSpecs[optionName];
    if (!optionSpec) {
      throw new Error(`Unknown plugin rule option: ${ruleId}.${optionName} in ${source}`);
    }
    const expectedType = optionSpec.type ?? getOptionValueType(optionSpec.default);
    if (expectedType && expectedType !== typeof optionValue) {
      throw new Error(`Plugin rule option type mismatch for ${ruleId}.${optionName}: expected ${expectedType}, got ${typeof optionValue}`);
    }
  }
}

function getOptionValueType(value: PluginRuleOptionValue | undefined): "string" | "number" | "boolean" | null {
  if (value === undefined) return null;
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  return "boolean";
}

function renderTemplate(template: string, options: PluginRuleOptions, ruleId: string, field: string): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_, optionName: string) => {
    const value = options[optionName];
    if (value === undefined) {
      throw new Error(`Missing plugin rule option for ${ruleId}.${field}: ${optionName}`);
    }
    return String(value);
  });
}

function getLineMatches(regex: RegExp, line: string): RegExpExecArray[] {
  const matcher = new RegExp(regex.source, regex.flags);
  const matches: RegExpExecArray[] = [];

  if (!matcher.global) {
    const match = matcher.exec(line);
    return match ? [match] : [];
  }

  while (true) {
    const match = matcher.exec(line);
    if (!match) break;
    matches.push(match);
    if (match[0] === "") {
      matcher.lastIndex += 1;
    }
  }

  return matches;
}

function normalizeDeltaIdentity(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function toRelativePath(filePath: string, rootPath: string): string {
  return relative(rootPath, filePath).split(sep).join("/");
}

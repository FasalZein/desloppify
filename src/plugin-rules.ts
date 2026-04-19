import { existsSync } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";
import type { FileEntry } from "./analyzers/file-walker";
import { matchesConfigGlob, type DesloppifyConfig } from "./config";
import { PLUGIN_API_VERSION, type DesloppifyPlugin, type DesloppifyPluginRuleSpec } from "./plugin-api";
import type { Category, Issue, Severity } from "./types";
import type { RuleCatalogEntry } from "./rule-catalog";

interface LegacyPluginFile {
  rules?: DesloppifyPluginRuleSpec[];
  configs?: Record<string, DesloppifyConfig>;
}

export interface LoadedPluginRule {
  id: string;
  category: Category;
  severity: Severity;
  message: string;
  description: string;
  regex: RegExp;
  files: string[];
  tier: number;
  tool: string;
}

export interface LoadedPluginModuleEntry {
  namespace: string;
  plugin: DesloppifyPlugin;
}

export function loadConfiguredPlugins(config: DesloppifyConfig, rootPath: string): LoadedPluginModuleEntry[] {
  return Object.entries(config.plugins ?? {}).map(([namespace, ref]) => {
    const plugin = loadPluginModule(rootPath, ref);
    validatePlugin(namespace, plugin, ref);
    return { namespace, plugin };
  });
}

function validatePlugin(namespace: string, plugin: DesloppifyPlugin, ref: string): void {
  if (!plugin.meta.name) {
    throw new Error(`Plugin metadata must include meta.name: ${ref}`);
  }
  if (plugin.meta.apiVersion !== PLUGIN_API_VERSION) {
    throw new Error(`Unsupported plugin apiVersion for ${ref}: ${plugin.meta.apiVersion}`);
  }
  if (plugin.meta.namespace && plugin.meta.namespace !== namespace) {
    throw new Error(`Plugin namespace mismatch for ${ref}: expected ${namespace}, got ${plugin.meta.namespace}`);
  }

  const ids = new Set<string>();
  for (const rule of plugin.rules ?? []) {
    if (!rule.id || rule.id.includes("/")) {
      throw new Error(`Plugin rule ids must be local ids without namespace: ${namespace}/${rule.id}`);
    }
    if (ids.has(rule.id)) {
      throw new Error(`Duplicate plugin rule id: ${namespace}/${rule.id}`);
    }
    ids.add(rule.id);
  }
}

export function loadConfigPluginRules(config: DesloppifyConfig, rootPath: string): LoadedPluginRule[] {
  const loaded: LoadedPluginRule[] = [];

  for (const { namespace, plugin } of loadConfiguredPlugins(config, rootPath)) {
    for (const rule of plugin.rules ?? []) {
      loaded.push({
        id: `${namespace}/${rule.id}`,
        category: rule.category,
        severity: rule.severity,
        message: rule.message,
        description: rule.description ?? rule.message,
        regex: new RegExp(rule.pattern, rule.flags),
        files: rule.files ?? ["**/*"],
        tier: rule.tier ?? 0,
        tool: `plugin:${namespace}`,
      });
    }
  }

  return loaded;
}

export function resolvePluginConfigExtends(extendsRefs: string[] | undefined, config: DesloppifyConfig, rootPath: string): DesloppifyConfig {
  const merged: DesloppifyConfig = {};
  if (!extendsRefs?.length) return merged;

  const plugins = new Map(loadConfiguredPlugins(config, rootPath).map((entry) => [entry.namespace, entry.plugin]));

  for (const ref of extendsRefs) {
    const match = /^plugin:([^/]+)\/(.+)$/.exec(ref);
    if (!match) continue;
    const [, namespace, configName] = match;
    const plugin = plugins.get(namespace);
    if (!plugin) throw new Error(`Cannot resolve plugin config: ${ref}`);
    const pluginConfig = plugin.configs?.[configName];
    if (!pluginConfig) throw new Error(`Cannot resolve plugin config: ${ref}`);
    merged.rules = { ...(merged.rules ?? {}), ...(pluginConfig.rules ?? {}) };
    merged.overrides = [...(merged.overrides ?? []), ...(pluginConfig.overrides ?? [])];
    merged.plugins = { ...(merged.plugins ?? {}), ...(pluginConfig.plugins ?? {}) };
  }

  return merged;
}

function loadPluginModule(rootPath: string, ref: string): DesloppifyPlugin {
  const pluginPath = resolve(rootPath, ref);
  if (!existsSync(pluginPath)) {
    throw new Error(`Cannot resolve plugin: ${ref}`);
  }

  const loaded = require(pluginPath) as DesloppifyPlugin | LegacyPluginFile | { default?: DesloppifyPlugin | LegacyPluginFile };
  const plugin = (loaded as { default?: DesloppifyPlugin | LegacyPluginFile }).default ?? loaded;
  return normalizePlugin(pluginPath, plugin as DesloppifyPlugin | LegacyPluginFile);
}

function normalizePlugin(pluginPath: string, plugin: DesloppifyPlugin | LegacyPluginFile): DesloppifyPlugin {
  if (isPluginModule(plugin)) return plugin;
  if (extname(pluginPath) === ".json") {
    return {
      meta: {
        name: pluginPath.split(sep).at(-1) ?? "local-plugin",
        apiVersion: PLUGIN_API_VERSION,
      },
      rules: plugin.rules,
      configs: plugin.configs,
    };
  }

  throw new Error(`Plugin modules must export definePlugin(...) metadata: ${pluginPath}`);
}

function isPluginModule(plugin: DesloppifyPlugin | LegacyPluginFile): plugin is DesloppifyPlugin {
  return typeof (plugin as DesloppifyPlugin).meta?.apiVersion === "number";
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

export function runConfigPluginRules(entries: FileEntry[], rules: LoadedPluginRule[], rootPath: string): Issue[] {
  const issues: Issue[] = [];

  for (const entry of entries) {
    const relativePath = toRelativePath(entry.path, rootPath);
    for (const rule of rules) {
      if (!rule.files.some((pattern) => matchesConfigGlob(relativePath, pattern))) continue;
      for (let index = 0; index < entry.lines.length; index += 1) {
        rule.regex.lastIndex = 0;
        if (!rule.regex.test(entry.lines[index] ?? "")) continue;
        issues.push({
          id: rule.id,
          category: rule.category,
          severity: rule.severity,
          tier: rule.tier as 0 | 1 | 2 | 3,
          file: entry.path,
          line: index + 1,
          message: rule.message,
          tool: rule.tool,
        });
      }
    }
  }

  return issues;
}

function toRelativePath(filePath: string, rootPath: string): string {
  return relative(rootPath, filePath).split(sep).join("/");
}

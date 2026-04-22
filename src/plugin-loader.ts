import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, isAbsolute, resolve, sep } from "node:path";
import type { DesloppifyConfig, PluginRuleOptionValue, PluginRuleOptions, RuleOverride } from "./config-types";
import {
  PLUGIN_API_VERSION,
  type DesloppifyPlugin,
  type DesloppifyPluginRuleOptionSpec,
  type DesloppifyPluginRuleSpec,
} from "./plugin-api";

interface LegacyPluginFile {
  rules?: DesloppifyPluginRuleSpec[];
  configs?: Record<string, DesloppifyConfig>;
}

interface LoadedPluginModuleEntry {
  namespace: string;
  plugin: DesloppifyPlugin;
}

export function loadConfiguredPlugins(config: DesloppifyConfig, rootPath: string): LoadedPluginModuleEntry[] {
  if (!config.plugins) return [];

  return Object.entries(config.plugins).map(([namespace, ref]) => {
    const plugin = loadPluginModule(rootPath, ref);
    validatePlugin(namespace, plugin, ref);
    return { namespace, plugin };
  });
}

function mergeRecords<T>(base: Record<string, T> | undefined, next: Record<string, T> | undefined): Record<string, T> | undefined {
  if (!base) return next ? { ...next } : undefined;
  if (!next) return { ...base };
  return {
    ...base,
    ...next,
  };
}

function mergeLists<T>(base: T[] | undefined, next: T[] | undefined): T[] | undefined {
  if (!base) return next ? [...next] : undefined;
  if (!next) return [...base];
  return [...base, ...next];
}

function cloneOptions(options: PluginRuleOptions | undefined): PluginRuleOptions | undefined {
  return options ? { ...options } : undefined;
}

function cloneRuleOverride(override: RuleOverride): RuleOverride {
  return {
    ...override,
    options: cloneOptions(override.options),
  };
}

function mergeOptions(base: PluginRuleOptions | undefined, next: PluginRuleOptions | undefined): PluginRuleOptions | undefined {
  if (!base) return cloneOptions(next);
  if (!next) return cloneOptions(base);
  return {
    ...base,
    ...next,
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

function mergeRuleRecords(
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

export function resolvePluginConfigExtends(extendsRefs: string[] | undefined, config: DesloppifyConfig, rootPath: string): DesloppifyConfig {
  const merged: DesloppifyConfig = {};
  if (!extendsRefs?.length) return merged;

  const plugins = new Map(loadConfiguredPlugins(config, rootPath).map((entry) => [entry.namespace, entry.plugin]));

  for (const ref of extendsRefs) {
    const match = /^plugin:([^/]+)\/(.+)$/.exec(ref);
    const namespace = match?.[1];
    const configName = match?.[2];
    if (!namespace || !configName) continue;
    const plugin = plugins.get(namespace);
    if (!plugin) throw new Error(`Cannot resolve plugin config: ${ref}`);
    const pluginConfig = plugin.configs?.[configName];
    if (!pluginConfig) throw new Error(`Cannot resolve plugin config: ${ref}`);
    merged.rules = mergeRuleRecords(merged.rules, pluginConfig.rules);
    merged.overrides = mergeLists(merged.overrides, pluginConfig.overrides);
    merged.plugins = mergeRecords(merged.plugins, pluginConfig.plugins);
  }

  return merged;
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
    validatePluginRuleOptions(`${namespace}/${rule.id}`, rule.options);
  }
}

function validatePluginRuleOptions(
  ruleId: string,
  optionSpecs: Record<string, DesloppifyPluginRuleOptionSpec> | undefined,
): void {
  for (const [optionName, optionSpec] of Object.entries(optionSpecs ?? {})) {
    if (!optionName.trim()) {
      throw new Error(`Plugin rule option names must be non-empty: ${ruleId}`);
    }
    if (!optionSpec.type || optionSpec.default === undefined) continue;
    const defaultType = getOptionValueType(optionSpec.default);
    if (defaultType !== optionSpec.type) {
      throw new Error(`Plugin rule option default type mismatch for ${ruleId}.${optionName}: expected ${optionSpec.type}, got ${defaultType}`);
    }
  }
}

function getOptionValueType(value: PluginRuleOptionValue): "string" | "number" | "boolean" {
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  return "boolean";
}

function loadPluginModule(rootPath: string, ref: string): DesloppifyPlugin {
  const { id, loaded } = loadModule(rootPath, ref);
  const plugin = (loaded as { default?: DesloppifyPlugin | LegacyPluginFile }).default ?? loaded;
  return normalizePlugin(id, plugin as DesloppifyPlugin | LegacyPluginFile);
}

function loadModule(rootPath: string, ref: string): { id: string; loaded: unknown } {
  const requireFromRoot = createRequire(resolve(rootPath, "package.json"));

  if (ref.startsWith(".") || isAbsolute(ref)) {
    const modulePath = resolve(rootPath, ref);
    if (!existsSync(modulePath)) {
      throw new Error(`Cannot resolve plugin: ${ref}`);
    }
    return { id: modulePath, loaded: requireFromRoot(modulePath) };
  }

  try {
    return { id: ref, loaded: requireFromRoot(ref) };
  } catch {
    throw new Error(`Cannot resolve plugin: ${ref}`);
  }
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

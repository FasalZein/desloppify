import type { DesloppifyConfig, PluginRuleOptionValue } from "./config-types";
import type { Category, Severity } from "./types";

export const PLUGIN_API_VERSION = 1;

export type DesloppifyPluginRuleOptionType = "string" | "number" | "boolean";

export interface DesloppifyPluginRuleOptionSpec {
  description?: string;
  type?: DesloppifyPluginRuleOptionType;
  default?: PluginRuleOptionValue;
}

export interface DesloppifyPluginRuleSpec {
  id: string;
  category: Category;
  severity: Severity;
  message: string;
  description?: string;
  fix?: string;
  pattern: string;
  flags?: string;
  files?: string[];
  tier?: number;
  identityGroup?: number;
  options?: Record<string, DesloppifyPluginRuleOptionSpec>;
}

export interface DesloppifyPluginMeta {
  name: string;
  apiVersion: number;
  version?: string;
  namespace?: string;
}

export interface DesloppifyPlugin {
  meta: DesloppifyPluginMeta;
  rules?: DesloppifyPluginRuleSpec[];
  configs?: Record<string, DesloppifyConfig>;
}

export function definePlugin(plugin: DesloppifyPlugin): DesloppifyPlugin {
  return plugin;
}

import type { DesloppifyConfig } from "./config";
import type { Category, Severity } from "./types";

export const PLUGIN_API_VERSION = 1;

export interface DesloppifyPluginRuleSpec {
  id: string;
  category: Category;
  severity: Severity;
  message: string;
  description?: string;
  pattern: string;
  flags?: string;
  files?: string[];
  tier?: number;
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

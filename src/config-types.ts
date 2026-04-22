import type { Severity } from "./types";

export type PluginRuleOptionValue = string | number | boolean;
export type PluginRuleOptions = Record<string, PluginRuleOptionValue>;

export interface RuleOverride {
  enabled?: boolean;
  severity?: Severity;
  weight?: number;
  options?: PluginRuleOptions;
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

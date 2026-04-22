import type { ToolStatus } from "./types";
import type { ExternalAnalyzerResult } from "./analyzers/external-result";

export interface BuiltinExternalTask {
  name: string;
  promise: Promise<ExternalAnalyzerResult>;
}

export type BuiltinExternalAnalyzerId = "knip" | "madge" | "ast-grep" | "tsc" | "eslint" | "biome" | "oxlint" | "ruff" | "cargo-clippy" | "staticcheck" | "golangci-lint" | "rubocop";

export interface BuiltinExternalRunOptions {
  category?: string;
  partial?: boolean;
  withMadge?: boolean;
}

export interface ExternalAnalyzerDefinition<AnalyzerId extends string> {
  id: AnalyzerId;
  enabled: (tools: ToolStatus, options: BuiltinExternalRunOptions) => boolean;
  createTask: (targetPath: string) => BuiltinExternalTask;
}

export function listExternalAnalyzerIds<AnalyzerId extends string>(
  analyzers: readonly ExternalAnalyzerDefinition<AnalyzerId>[],
  tools: ToolStatus,
  options: BuiltinExternalRunOptions = {},
): AnalyzerId[] {
  if (options.partial) return [];

  return analyzers.filter((analyzer) => analyzer.enabled(tools, options)).map((analyzer) => analyzer.id);
}

export function getExternalTasks<AnalyzerId extends string>(
  analyzers: readonly ExternalAnalyzerDefinition<AnalyzerId>[],
  targetPath: string,
  tools: ToolStatus,
  options: BuiltinExternalRunOptions = {},
): BuiltinExternalTask[] {
  if (options.partial) return [];

  return analyzers.filter((analyzer) => analyzer.enabled(tools, options)).map((analyzer) => analyzer.createTask(targetPath));
}

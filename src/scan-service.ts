import { isAbsolute, resolve } from "node:path";
import { listChangedFiles, listStagedFiles } from "./changed-files";
import { applyConfigToIssues, loadDesloppifyConfig } from "./config";
import { readFiles, walkFiles, type FileEntry } from "./analyzers/file-walker";
import type { LoadedDesloppifyConfig } from "./config-types";
import type { ExternalAnalyzerResult } from "./analyzers/external-result";
import type { ArchitectureProfileName } from "./architecture";
import { getPackExternalTasks, runPackInternalAnalyzers } from "./packs";
import { loadConfigPluginRules, runConfigPluginRules, type LoadedPluginRule } from "./plugin-rules";
import { detectTools } from "./tools";
import type { Issue, PackSelection, ToolStatus } from "./types";

interface AnalysisContext {
  tools: ToolStatus;
  loadedConfig: LoadedDesloppifyConfig;
  pluginRules: LoadedPluginRule[];
}

interface AnalysisScope {
  staged?: boolean;
  changed?: boolean;
  base?: string;
}

interface AnalysisResult {
  issues: Issue[];
  internalIssues: Issue[];
  pluginIssues: Issue[];
  externalIssues: Issue[];
  externalTaskNames: string[];
  externalWarnings: string[];
}

function normalizeIssuePath(targetPath: string, filePath: string): string {
  if (filePath === "unknown" || filePath.length === 0) return filePath;
  return isAbsolute(filePath) ? filePath : resolve(targetPath, filePath);
}

export function normalizeIssuePaths(targetPath: string, issues: Issue[]): Issue[] {
  return issues.map((issue) => ({
    ...issue,
    file: normalizeIssuePath(targetPath, issue.file),
  }));
}

export function createAnalysisContext(targetPath: string): AnalysisContext {
  const tools = detectTools(targetPath);
  const loadedConfig = loadDesloppifyConfig(targetPath);
  const pluginRules = loadConfigPluginRules(loadedConfig.config, targetPath);
  return { tools, loadedConfig, pluginRules };
}

export function getAnalysisScopeLabel(scope: AnalysisScope): string {
  if (scope.staged) return "staged files";
  if (scope.changed) return "branch changes";
  return "file tree";
}

export async function resolveAnalysisEntries(targetPath: string, scope: AnalysisScope = {}): Promise<FileEntry[]> {
  const files = scope.staged
    ? listStagedFiles(targetPath)
    : scope.changed
      ? listChangedFiles(targetPath, scope.base)
      : null;

  return files ? readFiles(targetPath, files) : walkFiles(targetPath);
}

export async function runAnalysisPipeline(
  targetPath: string,
  entries: FileEntry[],
  context: AnalysisContext,
  options: {
    pack: PackSelection;
    architecture?: ArchitectureProfileName;
    category?: string;
    partial?: boolean;
    withMadge?: boolean;
  },
): Promise<AnalysisResult> {
  const internalIssues = runPackInternalAnalyzers(options.pack.name, entries, {
    architecture: options.architecture,
  });

  const pluginIssues = context.pluginRules.length > 0
    ? runConfigPluginRules(entries, context.pluginRules, context.loadedConfig.config, targetPath)
    : [];

  const tasks = getPackExternalTasks(options.pack.name, targetPath, context.tools, {
    category: options.category,
    partial: options.partial,
    withMadge: options.withMadge,
  });
  const externalTaskNames = tasks.map((task) => task.name);
  const externalResults: ExternalAnalyzerResult[] = tasks.length > 0
    ? await Promise.all(tasks.map((task) => task.promise))
    : [];
  const externalIssues = externalResults.flatMap((result: ExternalAnalyzerResult) => result.issues);
  const externalWarnings = externalResults.flatMap((result: ExternalAnalyzerResult) => result.warning ? [result.warning] : []);

  const configuredIssues = applyConfigToIssues(
    normalizeIssuePaths(targetPath, [...internalIssues, ...pluginIssues, ...externalIssues]),
    context.loadedConfig.config,
    targetPath,
  );

  return {
    issues: options.category
      ? configuredIssues.filter((issue) => issue.category === options.category)
      : configuredIssues,
    internalIssues,
    pluginIssues,
    externalIssues,
    externalTaskNames,
    externalWarnings,
  };
}

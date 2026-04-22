import { resolve } from "node:path";
import { isArchitectureProfile, resolveArchitectureProfileName, type ArchitectureProfileName } from "./architecture";
import { resolvePackSelection } from "./packs";
import { buildScanReport, buildScanSummary, type ScanReportSummary } from "./report";
import { compareScanReports } from "./scan-delta";
import { createAnalysisContext, resolveAnalysisEntries, runAnalysisPipeline } from "./scan-service";
import { calculateScore } from "./scoring";
import type { PackSelection, ScanReport } from "./types";

export type { ArchitectureProfileName } from "./architecture";
export type { Category, Finding, Issue, PackName, PackSelection, ScanReport, Severity, ToolStatus } from "./types";
export type { ScanReportSummary } from "./report";

export interface ScanProjectOptions {
  path?: string;
  pack?: string;
  architecture?: ArchitectureProfileName | string;
  category?: string;
  staged?: boolean;
  changed?: boolean;
  base?: string;
  withMadge?: boolean;
}

function resolveArchitectureOption(value?: ArchitectureProfileName | string): ArchitectureProfileName | undefined {
  if (!value) return undefined;
  if (!isArchitectureProfile(value)) {
    throw new Error(`Unknown architecture profile: ${value}`);
  }
  return resolveArchitectureProfileName(value);
}

function resolvePackOption(value?: string): PackSelection {
  return resolvePackSelection(value);
}

export async function scanProject(options: ScanProjectOptions = {}): Promise<ScanReport> {
  const targetPath = resolve(options.path ?? ".");
  const pack = resolvePackOption(options.pack);
  const architecture = resolveArchitectureOption(options.architecture);
  const context = createAnalysisContext(targetPath);
  const entries = await resolveAnalysisEntries(targetPath, {
    staged: options.staged,
    changed: options.changed,
    base: options.base,
  });

  const analysis = await runAnalysisPipeline(targetPath, entries, context, {
    pack,
    architecture,
    category: options.category,
    partial: Boolean(options.staged || options.changed),
    withMadge: options.withMadge || options.category === "circular-deps",
  });

  return buildScanReport(targetPath, context.tools, analysis.issues, pack, architecture, {
    fileCount: entries.length,
    lineCount: entries.reduce((sum, entry) => sum + entry.lines.length, 0),
    nonEmptyLineCount: entries.reduce((sum, entry) => sum + entry.lines.filter((line) => line.trim().length > 0).length, 0),
  });
}

export async function scanProjectSummary(options: ScanProjectOptions = {}): Promise<ScanReportSummary> {
  return buildScanSummary(await scanProject(options));
}

export function summarizeScanReport(report: ScanReport): ScanReportSummary {
  return buildScanSummary(report);
}

export { calculateScore, compareScanReports };

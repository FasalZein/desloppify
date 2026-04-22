import { existsSync, readFileSync } from "node:fs";
import { defineCommand } from "citty";
import { resolve } from "node:path";
import { getReportArtifacts } from "../report-artifacts";
import { buildScanSummary } from "../report";
import type { PathHotspot, ScanReport } from "../types";

export default defineCommand({
  meta: { name: "report", description: "Render normalized metrics from a saved scan report" },
  args: {
    path: { type: "positional", description: "Repo path containing .desloppify reports", default: "." },
    report: { type: "string", description: "Explicit findings report JSON path" },
    json: { type: "boolean", description: "JSON output" },
    summary: { type: "boolean", description: "Emit compact JSON summary instead of the full saved findings payload" },
  },
  run({ args }) {
    const rootPath = resolve(args.path);
    const reportPath = args.report ? resolve(args.report) : getReportArtifacts(rootPath).findingsJson;
    if (!existsSync(reportPath)) {
      throw new Error(`No saved scan report found at ${reportPath}. Run desloppify scan ${args.path} first.`);
    }

    const report = JSON.parse(readFileSync(reportPath, "utf8")) as ScanReport;

    if (args.json) {
      console.log(JSON.stringify(args.summary ? buildScanSummary(report) : report, null, 2));
      return;
    }

    console.log(formatTextReport(report));
  },
});

function formatNumber(value: number | null): string {
  return value === null ? "n/a" : value.toFixed(2);
}

function formatHotspot(hotspot: PathHotspot): string {
  return `- ${hotspot.path}: penalty=${hotspot.penalty.toFixed(2)} findings=${hotspot.findingCount}`;
}

function formatTextReport(report: ScanReport): string {
  const categoryLines = Object.entries(report.categories)
    .sort((left, right) => right[1].count - left[1].count || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([category, summary]) => `- ${category}: findings=${summary.count} fixable=${summary.fixable}`);

  const lines = [
    "desloppify report",
    `path: ${report.scan.path}`,
    `generated: ${report.scan.generatedAt}`,
    `pack: ${report.scan.pack.name}`,
    `score: ${report.score}`,
    "",
    "Coverage:",
    `- files scanned: ${report.metrics.fileCount}`,
    `- lines: ${report.metrics.lineCount}`,
    `- non-empty lines: ${report.metrics.nonEmptyLineCount}`,
    "",
    "Normalized metrics:",
    `- score / file: ${formatNumber(report.metrics.normalized.scorePerFile)}`,
    `- score / KLOC: ${formatNumber(report.metrics.normalized.scorePerKloc)}`,
    `- findings / file: ${formatNumber(report.metrics.normalized.findingsPerFile)}`,
    `- findings / KLOC: ${formatNumber(report.metrics.normalized.findingsPerKloc)}`,
    "",
    "Raw totals:",
    `- findings: ${report.findings.length}`,
    `- critical/high/medium/low: ${report.summary.critical}/${report.summary.high}/${report.summary.medium}/${report.summary.low}`,
  ];

  if (categoryLines.length > 0) {
    lines.push("", "Top categories:", ...categoryLines);
  }

  if (report.hotspots.paths.length > 0) {
    lines.push("", "Path hotspots:", ...report.hotspots.paths.map(formatHotspot));
  }

  return lines.join("\n");
}

export { formatTextReport };

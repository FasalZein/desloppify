import { defineCommand } from "citty";
import { resolve } from "path";
import type { ScanReport } from "../types";
import * as p from "@clack/prompts";
import { buildArchitectureSummary, isArchitectureProfile, resolveArchitectureProfileName } from "../architecture";
import { calculateScore } from "./score";
import { buildScanReport, buildScanSummary } from "../report";
import { getPackMeta, resolvePackSelection } from "../packs";
import { createAnalysisContext, getAnalysisScopeLabel, resolveAnalysisEntries, runAnalysisPipeline } from "../scan-service";
import { buildWikiReport, formatWikiHandoffMarkdown } from "../wiki-output";
import { loadSavedScanReport, saveScanArtifacts } from "../report-artifacts";
import { buildWorkflowCommands } from "../scan-workflow";
import { compareScanReports } from "../scan-delta";
import {
  scanIntro, scanOutro, createSpinner, showTools,
  showScore, showSeveritySummary, showCategories, showIssues, showNextActions,
} from "../ui";

export default defineCommand({
  meta: { name: "scan", description: "Analyze codebase for issues" },
  args: {
    path: { type: "positional", description: "Path to scan", default: "." },
    category: { type: "string", description: "Scan single category only" },
    json: { type: "boolean", description: "Machine-readable JSON output" },
    summary: { type: "boolean", description: "Emit compact JSON/report summary instead of full findings payload" },
    markdown: { type: "boolean", description: "Markdown report output" },
    wiki: { type: "boolean", description: "Wiki-forge JSON review output" },
    handoff: { type: "boolean", description: "Compact Markdown handoff output" },
    verbose: { type: "boolean", description: "Show all issues (no limit)" },
    architecture: { type: "string", description: "Architecture profile (e.g. modular-monolith)" },
    pack: { type: "string", description: "Rule pack (e.g. js-ts)" },
    staged: { type: "boolean", description: "Scan staged git changes only" },
    changed: { type: "boolean", description: "Scan current branch diff only" },
    base: { type: "string", description: "Base ref for --changed" },
    "with-madge": { type: "boolean", description: "Run madge circular dependency analysis during full scans" },
    project: { type: "string", description: "Wiki project name for wiki-native output" },
    slice: { type: "string", description: "Slice ID for wiki-native output" },
    prd: { type: "string", description: "PRD ID for wiki-native output" },
    feature: { type: "string", description: "Feature ID for wiki-native output" },
    "group-by": { type: "string", description: "Group issues by: severity (default) or category" },
  },
  async run({ args }) {
    const targetPath = resolve(args.path);
    if (args.architecture && !isArchitectureProfile(args.architecture)) {
      throw new Error(`Unknown architecture profile: ${args.architecture}`);
    }
    if (args.staged && args.changed) {
      throw new Error("Use either --staged or --changed, not both");
    }

    const architecture = resolveArchitectureProfileName(args.architecture);
    const pack = resolvePackSelection(args.pack);
    const context = createAnalysisContext(targetPath);
    const isJson = args.json;
    const isWiki = args.wiki;
    const isHandoff = args.handoff;
    const isPartialScan = Boolean(args.staged || args.changed);
    const t0 = performance.now();

    if (!isJson && !isWiki && !isHandoff && !args.markdown) {
      scanIntro("1.0.2");
      showTools(context.tools);
      p.log.info(`Pack: ${pack.name}${pack.explicit ? "" : " (default)"}`);
      if (architecture) p.log.info(`Architecture: ${architecture}`);
      if (context.loadedConfig.path) p.log.info(`Config: ${context.loadedConfig.path}`);
    }

    const spin = (!isJson && !isWiki && !isHandoff && !args.markdown) ? createSpinner() : null;

    spin?.start(`Walking ${getAnalysisScopeLabel({ staged: args.staged, changed: args.changed })}...`);
    const entries = await resolveAnalysisEntries(targetPath, {
      staged: args.staged,
      changed: args.changed,
      base: args.base,
    });

    spin?.message(`Analyzing ${entries.length} files...`);
    const analysis = await runAnalysisPipeline(targetPath, entries, context, {
      pack,
      architecture,
      category: args.category,
      partial: isPartialScan,
      withMadge: args["with-madge"] || args.category === "circular-deps",
    });
    spin?.stop(`${entries.length} files scanned — ${analysis.internalIssues.length} issues from pattern analysis`);

    if (analysis.externalTaskNames.length > 0 && !isJson && !isWiki && !isHandoff && !args.markdown) {
      p.log.info(`External tools done (${analysis.externalTaskNames.join(", ")}) — ${analysis.externalIssues.length} additional issues`);
    } else if (isPartialScan && !isJson && !isWiki && !isHandoff && !args.markdown) {
      p.log.info("Partial scan mode skips whole-project analyzers (knip, madge, ast-grep, tsc)");
    } else if (pack.name === "js-ts" && !args.category && !args["with-madge"] && !isJson && !isWiki && !isHandoff && !args.markdown) {
      p.log.info("Skipping madge by default on full scans — rerun with --with-madge or --category circular-deps");
    }

    const filtered = analysis.issues;

    if (analysis.externalWarnings.length > 0) {
      const warningText = analysis.externalWarnings.join("\n");
      if (isJson || isWiki || isHandoff || args.markdown) {
        console.error(warningText);
      } else {
        p.note(warningText, "External analyzer warnings");
      }
    }

    const elapsed = performance.now() - t0;

    const previousReport = loadSavedScanReport(targetPath);
    const report = buildScanReport(targetPath, context.tools, filtered, pack, architecture, {
      fileCount: entries.length,
      lineCount: entries.reduce((sum, entry) => sum + entry.lines.length, 0),
      nonEmptyLineCount: entries.reduce((sum, entry) => sum + entry.lines.filter((line) => line.trim().length > 0).length, 0),
    });
    const deltaReport = previousReport ? compareScanReports(previousReport, report) : null;
    const wikiReport = buildWikiReport(report, {
      project: args.project,
      sliceId: args.slice,
      prdId: args.prd,
      featureId: args.feature,
      deltaReport,
    });
    const reportMarkdown = formatMarkdown(report);
    const handoffMarkdown = formatWikiHandoffMarkdown(wikiReport);

    const artifacts = saveScanArtifacts(targetPath, report, wikiReport, reportMarkdown, handoffMarkdown, deltaReport);
    const workflowCommands = buildWorkflowCommands({
      rootPath: targetPath,
      project: args.project,
      hasDelta: Boolean(deltaReport),
    });

    // ── JSON output ────────────────────────────────────────────
    if (isJson) {
      console.log(JSON.stringify(args.summary ? buildScanSummary(report) : report, null, 2));
      process.exit(report.findings.length > 0 ? 1 : 0);
    }

    // ── Wiki JSON output ───────────────────────────────────────
    if (isWiki) {
      console.log(JSON.stringify(wikiReport, null, 2));
      process.exit(report.findings.length > 0 ? 1 : 0);
    }

    // ── Markdown outputs ───────────────────────────────────────
    if (args.markdown) {
      console.log(reportMarkdown);
      process.exit(filtered.length > 0 ? 1 : 0);
    }
    if (isHandoff) {
      console.log(handoffMarkdown);
      process.exit(filtered.length > 0 ? 1 : 0);
    }

    // ── Pretty terminal output ─────────────────────────────────
    const { score, grade, penalty } = calculateScore(filtered);

    // Score box
    showScore(score, grade, filtered.length, penalty);

    // Severity summary
    const summary = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const issue of filtered) {
      summary[issue.severity.toLowerCase() as keyof typeof summary]++;
    }
    showSeveritySummary(summary);

    // Category breakdown
    const categories: Record<string, { count: number; fixable: number }> = {};
    for (const issue of filtered) {
      const bucket = categories[issue.category] ?? { count: 0, fixable: 0 };
      bucket.count++;
      if (issue.tier > 0) bucket.fixable++;
      categories[issue.category] = bucket;
    }
    showCategories(categories);

    const architectureSummary = buildArchitectureSummary(architecture, filtered);
    if (architectureSummary) {
      const topViolations = Object.entries(architectureSummary.violations)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => `${id}: ${count}`)
        .join("\n");
      p.note([
        `Pack: ${getPackMeta(pack.name).name}`,
        `Profile: ${architectureSummary.profile}`,
        `Fit: ${architectureSummary.fitScore}/100`,
        topViolations ? `Top violations:\n${topViolations}` : "Top violations: none",
        `Exemptions: ${architectureSummary.exemptionsApplied.join(", ")}`,
      ].join("\n\n"), "Architecture");
    }

    // Issues list
    if (filtered.length > 0) {
      const groupBy = args["group-by"] === "category" ? "category" : "severity";
      showIssues(filtered, { limit: args.verbose ? Infinity : 10, groupBy });
    }

    p.note([
      `Findings JSON: ${artifacts.findingsJson}`,
      `Readable report: ${artifacts.reportMarkdown}`,
      `Wiki report: ${artifacts.wikiJson}`,
      `Handoff: ${artifacts.handoffMarkdown}`,
      deltaReport ? `Delta report: ${artifacts.deltaJson}` : `Delta report: unavailable (no previous saved scan)`,
    ].join("\n"), "Saved reports");

    if (deltaReport) {
      p.note([
        `Added: ${deltaReport.summary.addedCount}`,
        `Resolved: ${deltaReport.summary.resolvedCount}`,
        `Worsened: ${deltaReport.summary.worsenedCount}`,
        `Improved: ${deltaReport.summary.improvedCount}`,
      ].join("\n"), "Delta vs previous scan");
    }

    const nextActions = [
      `Show normalized report: desloppify report ${args.path}`,
      `Show the current score again: desloppify score ${args.path} --pack ${pack.name}`,
      filtered.length > 0
        ? `Read machine findings: ${workflowCommands[0]?.command}`
        : `Install repo-local hooks: desloppify install-hooks`,
      deltaReport
        ? `Review scan delta: ${workflowCommands[1]?.command}`
        : `Run scan again later to compare against this baseline: desloppify scan ${args.path} --pack ${pack.name}`,
      filtered.length > 0
        ? `Prepare isolated fixes: ${workflowCommands[deltaReport ? 2 : 1]?.command}`
        : `Run a focused diff scan before commit: desloppify scan ${args.path} --staged --pack ${pack.name}`,
    ];
    showNextActions(nextActions);

    scanOutro(elapsed, entries.length);
    process.exit(filtered.length > 0 ? 1 : 0);
  },
});

function formatMarkdown(report: ScanReport): string {
  const lines: string[] = [
    "# Desloppify Report",
    "",
    `**Path:** ${report.scan.path}`,
    `**Pack:** ${report.scan.pack.name}`,
    report.architecture ? `**Architecture:** ${report.architecture.profile} (${report.architecture.fitScore}/100)` : "",
    `**Files scanned:** ${report.metrics.fileCount}`,
    `**Non-empty lines:** ${report.metrics.nonEmptyLineCount}`,
    "",
    "## Summary",
    `| Severity | Count |`,
    `|----------|-------|`,
    `| Critical | ${report.summary.critical} |`,
    `| High | ${report.summary.high} |`,
    `| Medium | ${report.summary.medium} |`,
    `| Low | ${report.summary.low} |`,
    "",
    "## Normalized Metrics",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Score / file | ${report.metrics.normalized.scorePerFile ?? "n/a"} |`,
    `| Score / KLOC | ${report.metrics.normalized.scorePerKloc ?? "n/a"} |`,
    `| Findings / file | ${report.metrics.normalized.findingsPerFile ?? "n/a"} |`,
    `| Findings / KLOC | ${report.metrics.normalized.findingsPerKloc ?? "n/a"} |`,
    "",
    "## Categories",
    `| Category | Issues | Fixable |`,
    `|----------|--------|---------|`,
    ...Object.entries(report.categories).map(
      ([cat, s]) => `| ${cat} | ${s.count} | ${s.fixable} |`
    ),
    "",
    "## Path Hotspots",
    `| Path | Findings | Penalty |`,
    `|------|----------|---------|`,
    ...report.hotspots.paths.map((hotspot) => `| ${hotspot.path} | ${hotspot.findingCount} | ${hotspot.penalty} |`),
    "",
    "## Issues",
    "",
  ];

  for (const sev of ["CRITICAL", "HIGH", "MEDIUM", "LOW"]) {
    const sevFindings = report.findings.filter((finding) => finding.severity === sev);
    if (sevFindings.length === 0) continue;
    lines.push(`### ${sev}`, "");
    for (const finding of sevFindings) {
      const location = finding.locations[finding.primary_location_index] ?? finding.locations[0] ?? {
        path: "<unknown>",
        range: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
      };
      lines.push(`- **${finding.rule_id}** \`${location.path}:${location.range.start.line}\` — ${finding.message}`);
      const firstFix = finding.fixes?.[0];
      if (firstFix?.description) lines.push(`  - Fix: ${firstFix.description}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export { formatMarkdown };

import { defineCommand } from "citty";
import { resolve } from "path";
import type { Issue, ScanReport, ToolStatus, Category, CategorySummary } from "../types";
import { detectTools } from "../tools";
import { runKnip } from "../analyzers/knip";
import { runMadge } from "../analyzers/madge";
import { runAstGrep } from "../analyzers/ast-grep";
import { runTsc } from "../analyzers/tsc";
import { readFiles, walkFiles } from "../analyzers/file-walker";
import { runGrepPatternsFromEntries } from "../analyzers/grep-patterns";
import { runFileMetricsFromEntries } from "../analyzers/file-metrics";
import { runGrepExtendedFromEntries } from "../analyzers/grep-extended";
import { runArchitectureProfileFromEntries } from "../analyzers/architecture-profile";
import * as p from "@clack/prompts";
import { buildArchitectureSummary, isArchitectureProfile, resolveArchitectureProfileName } from "../architecture";
import { listChangedFiles, listStagedFiles } from "../changed-files";
import { calculateScore } from "./score";
import {
  scanIntro, scanOutro, createSpinner, showTools,
  showScore, showSeveritySummary, showCategories, showIssues,
} from "../ui";

export default defineCommand({
  meta: { name: "scan", description: "Analyze codebase for issues" },
  args: {
    path: { type: "positional", description: "Path to scan", default: "." },
    category: { type: "string", description: "Scan single category only" },
    json: { type: "boolean", description: "Machine-readable JSON output" },
    markdown: { type: "boolean", description: "Markdown report output" },
    verbose: { type: "boolean", description: "Show all issues (no limit)" },
    architecture: { type: "string", description: "Architecture profile (e.g. modular-monolith)" },
    staged: { type: "boolean", description: "Scan staged git changes only" },
    changed: { type: "boolean", description: "Scan current branch diff only" },
    base: { type: "string", description: "Base ref for --changed" },
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
    const tools = detectTools();
    const allIssues: Issue[] = [];
    const isJson = args.json;
    const isPartialScan = Boolean(args.staged || args.changed);
    const t0 = performance.now();

    if (!isJson && !args.markdown) {
      scanIntro("0.0.1");
      showTools(tools);
      if (architecture) p.log.info(`Architecture: ${architecture}`);
    }

    const spin = (!isJson && !args.markdown) ? createSpinner() : null;

    // Phase 1: Collect files
    const scopeLabel = args.staged ? "staged files" : args.changed ? "branch changes" : "file tree";
    spin?.start(`Walking ${scopeLabel}...`);
    const files = args.staged
      ? listStagedFiles(targetPath)
      : args.changed
        ? listChangedFiles(targetPath, args.base)
        : null;
    const entries = files ? await readFiles(targetPath, files) : await walkFiles(targetPath);

    // Phase 2: Run internal analyzers
    spin?.message(`Analyzing ${entries.length} files...`);
    allIssues.push(...runGrepPatternsFromEntries(entries));
    allIssues.push(...runGrepExtendedFromEntries(entries));
    allIssues.push(...runFileMetricsFromEntries(entries, { architecture }));
    allIssues.push(...runArchitectureProfileFromEntries(entries, { architecture }));
    spin?.stop(`${entries.length} files scanned — ${allIssues.length} issues from pattern analysis`);

    // Phase 3: Run external tool analyzers
    const tasks: { name: string; promise: Promise<Issue[]> }[] = [];

    if (!isPartialScan) {
      if (tools.knip && (!args.category || args.category === "dead-code")) {
        tasks.push({ name: "knip", promise: runKnip(targetPath) });
      }
      if (tools.madge && (!args.category || args.category === "circular-deps")) {
        tasks.push({ name: "madge", promise: runMadge(targetPath) });
      }
      if (tools["ast-grep"]) {
        tasks.push({ name: "ast-grep", promise: runAstGrep(targetPath) });
      }
      if (tools.tsc && (!args.category || args.category === "weak-types")) {
        tasks.push({ name: "tsc", promise: runTsc(targetPath) });
      }
    }

    if (tasks.length > 0) {
      const extSpin = (!isJson && !args.markdown) ? createSpinner() : null;
      extSpin?.start(`Running ${tasks.map((t) => t.name).join(", ")}...`);
      const results = await Promise.all(tasks.map((t) => t.promise));
      let extCount = 0;
      for (const issues of results) {
        extCount += issues.length;
        allIssues.push(...issues);
      }
      extSpin?.stop(`External tools done — ${extCount} additional issues`);
    } else if (isPartialScan && !isJson && !args.markdown) {
      p.log.info("Partial scan mode skips whole-project analyzers (knip, madge, ast-grep, tsc)");
    }

    // Filter by category if specified
    const filtered = args.category
      ? allIssues.filter((i) => i.category === args.category)
      : allIssues;

    const elapsed = performance.now() - t0;

    // ── JSON output ────────────────────────────────────────────
    if (isJson) {
      const report = buildReport(targetPath, tools, filtered, architecture);
      console.log(JSON.stringify(report, null, 2));
      process.exit(report.issues.length > 0 ? 1 : 0);
    }

    // ── Markdown output ────────────────────────────────────────
    if (args.markdown) {
      console.log(formatMarkdown(buildReport(targetPath, tools, filtered, architecture)));
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
      if (!categories[issue.category]) categories[issue.category] = { count: 0, fixable: 0 };
      categories[issue.category].count++;
      if (issue.tier > 0) categories[issue.category].fixable++;
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

    scanOutro(elapsed, entries.length);
    process.exit(filtered.length > 0 ? 1 : 0);
  },
});

function buildReport(
  path: string,
  tools: ToolStatus,
  issues: Issue[],
  architecture?: string
): ScanReport {
  const summary = { critical: 0, high: 0, medium: 0, low: 0 };
  const categories: Partial<Record<Category, CategorySummary>> = {};

  for (const issue of issues) {
    summary[issue.severity.toLowerCase() as keyof typeof summary]++;
    if (!categories[issue.category]) {
      categories[issue.category] = { count: 0, fixable: 0 };
    }
    categories[issue.category]!.count++;
    if (issue.tier > 0) categories[issue.category]!.fixable++;
  }

  return {
    version: "0.0.1",
    path,
    architecture: buildArchitectureSummary(architecture, issues),
    tools,
    score: Math.max(0, 100 - issues.length * 2),
    summary,
    categories,
    issues,
  };
}

function formatMarkdown(report: ScanReport): string {
  const lines: string[] = [
    "# Desloppify Report",
    "",
    `**Path:** ${report.path}`,
    report.architecture ? `**Architecture:** ${report.architecture.profile} (${report.architecture.fitScore}/100)` : "",
    "",
    "## Summary",
    `| Severity | Count |`,
    `|----------|-------|`,
    `| Critical | ${report.summary.critical} |`,
    `| High | ${report.summary.high} |`,
    `| Medium | ${report.summary.medium} |`,
    `| Low | ${report.summary.low} |`,
    "",
    "## Categories",
    `| Category | Issues | Fixable |`,
    `|----------|--------|---------|`,
    ...Object.entries(report.categories).map(
      ([cat, s]) => `| ${cat} | ${s.count} | ${s.fixable} |`
    ),
    "",
    "## Issues",
    "",
  ];

  for (const sev of ["CRITICAL", "HIGH", "MEDIUM", "LOW"]) {
    const sevIssues = report.issues.filter((i) => i.severity === sev);
    if (sevIssues.length === 0) continue;
    lines.push(`### ${sev}`, "");
    for (const issue of sevIssues) {
      lines.push(`- **${issue.id}** \`${issue.file}:${issue.line}\` — ${issue.message}`);
      if (issue.fix) lines.push(`  - Fix: ${issue.fix}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

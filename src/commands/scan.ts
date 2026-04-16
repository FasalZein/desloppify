import { defineCommand } from "citty";
import { resolve } from "path";
import type { Issue, ScanReport, ToolStatus, Category, CategorySummary } from "../types";
import { detectTools } from "../tools";
import { runKnip } from "../analyzers/knip";
import { runMadge } from "../analyzers/madge";
import { runAstGrep } from "../analyzers/ast-grep";
import { runTsc } from "../analyzers/tsc";
import { walkFiles } from "../analyzers/file-walker";
import { runGrepPatternsFromEntries } from "../analyzers/grep-patterns";
import { runFileMetricsFromEntries } from "../analyzers/file-metrics";
import { runGrepExtendedFromEntries } from "../analyzers/grep-extended";
import { calculateScore, getGrade } from "./score";
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
    "group-by": { type: "string", description: "Group issues by: severity (default) or category" },
  },
  async run({ args }) {
    const targetPath = resolve(args.path);
    const tools = detectTools();
    const allIssues: Issue[] = [];
    const isJson = args.json;
    const t0 = performance.now();

    if (!isJson && !args.markdown) {
      scanIntro("0.0.1");
      showTools(tools);
    }

    const spin = (!isJson && !args.markdown) ? createSpinner() : null;

    // Phase 1: Walk files
    spin?.start("Walking file tree...");
    const entries = await walkFiles(targetPath);

    // Phase 2: Run internal analyzers
    spin?.message(`Analyzing ${entries.length} files...`);
    allIssues.push(...runGrepPatternsFromEntries(entries));
    allIssues.push(...runGrepExtendedFromEntries(entries));
    allIssues.push(...runFileMetricsFromEntries(entries));
    spin?.stop(`${entries.length} files scanned — ${allIssues.length} issues from pattern analysis`);

    // Phase 3: Run external tool analyzers
    const tasks: { name: string; promise: Promise<Issue[]> }[] = [];

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
    }

    // Filter by category if specified
    const filtered = args.category
      ? allIssues.filter((i) => i.category === args.category)
      : allIssues;

    const elapsed = performance.now() - t0;

    // ── JSON output ────────────────────────────────────────────
    if (isJson) {
      const report = buildReport(targetPath, tools, filtered);
      console.log(JSON.stringify(report, null, 2));
      process.exit(report.issues.length > 0 ? 1 : 0);
    }

    // ── Markdown output ────────────────────────────────────────
    if (args.markdown) {
      console.log(formatMarkdown(buildReport(targetPath, tools, filtered)));
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
  issues: Issue[]
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
    version: "2.0.0",
    path,
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

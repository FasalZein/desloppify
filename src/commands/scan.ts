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

export default defineCommand({
  meta: { name: "scan", description: "Analyze codebase for issues" },
  args: {
    path: { type: "positional", description: "Path to scan", default: "." },
    category: { type: "string", description: "Scan single category only" },
    json: { type: "boolean", description: "JSON output (default)", default: true },
    markdown: { type: "boolean", description: "Markdown report output" },
  },
  async run({ args }) {
    const targetPath = resolve(args.path);
    const tools = detectTools();
    const allIssues: Issue[] = [];

    // Single-pass file walk shared by grep-patterns, grep-extended, file-metrics
    const entries = await walkFiles(targetPath);

    // Run synchronous analyzers on shared file entries (no duplicate I/O)
    allIssues.push(...runGrepPatternsFromEntries(entries));
    allIssues.push(...runGrepExtendedFromEntries(entries));
    allIssues.push(...runFileMetricsFromEntries(entries));

    // Run external tool analyzers in parallel
    const tasks: Promise<Issue[]>[] = [];

    if (tools.knip && (!args.category || args.category === "dead-code")) {
      tasks.push(runKnip(targetPath));
    }

    if (tools.madge && (!args.category || args.category === "circular-deps")) {
      tasks.push(runMadge(targetPath));
    }

    if (tools["ast-grep"]) {
      tasks.push(runAstGrep(targetPath));
    }

    if (tools.tsc && (!args.category || args.category === "weak-types")) {
      tasks.push(runTsc(targetPath));
    }

    const results = await Promise.all(tasks);
    for (const issues of results) {
      allIssues.push(...issues);
    }

    // Filter by category if specified
    const filtered = args.category
      ? allIssues.filter((i) => i.category === args.category)
      : allIssues;

    const report = buildReport(targetPath, tools, filtered);

    if (args.markdown) {
      console.log(formatMarkdown(report));
    } else {
      console.log(JSON.stringify(report, null, 2));
    }

    process.exit(report.issues.length > 0 ? 1 : 0);
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
    if (issue.tier > 0) {
      categories[issue.category]!.fixable++;
    }
  }

  const total = issues.length;
  const score = total === 0 ? 100 : Math.max(0, 100 - total * 2);

  return {
    version: "1.0.0",
    path,
    tools,
    score,
    summary,
    categories,
    issues,
  };
}

function formatMarkdown(report: ScanReport): string {
  const lines: string[] = [
    "# Desloppify Report",
    "",
    `**Score:** ${report.score}/100`,
    `**Path:** ${report.path}`,
    "",
    "## Tools",
    ...Object.entries(report.tools).map(
      ([name, ok]) => `- ${name}: ${ok ? "available" : "unavailable"}`
    ),
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

  const bySeverity = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  for (const sev of bySeverity) {
    const sevIssues = report.issues.filter((i) => i.severity === sev);
    if (sevIssues.length === 0) continue;

    lines.push(`### ${sev}`, "");
    for (const issue of sevIssues) {
      lines.push(
        `- **${issue.id}** \`${issue.file}:${issue.line}\` — ${issue.message}`
      );
      if (issue.fix) lines.push(`  - Fix: ${issue.fix}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

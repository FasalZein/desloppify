/**
 * Terminal UI utilities for desloppify.
 * ANSI colors, progress, formatted output — zero dependencies.
 */

// ── ANSI codes ─────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  white: "\x1b[97m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
};

export function severityColor(sev: string): string {
  switch (sev) {
    case "CRITICAL": return c.red;
    case "HIGH": return c.yellow;
    case "MEDIUM": return c.cyan;
    case "LOW": return c.dim;
    default: return "";
  }
}

export function severityBadge(sev: string): string {
  const col = severityColor(sev);
  return `${col}${c.bold}${sev.padEnd(8)}${c.reset}`;
}

export function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return c.green;
  if (grade === "B") return c.yellow;
  if (grade === "C") return c.yellow;
  return c.red;
}

// ── Progress spinner ───────────────────────────────────────────
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export class Progress {
  private frame = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private message = "";

  start(msg: string) {
    this.message = msg;
    this.frame = 0;
    this.timer = setInterval(() => {
      const spin = SPINNER[this.frame % SPINNER.length];
      process.stderr.write(`\r  ${c.cyan}${spin}${c.reset} ${this.message}`);
      this.frame++;
    }, 80);
  }

  update(msg: string) {
    this.message = msg;
  }

  stop(msg?: string) {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    process.stderr.write(`\r\x1b[K`); // clear line
    if (msg) {
      process.stderr.write(`  ${c.green}✓${c.reset} ${msg}\n`);
    }
  }
}

// ── Formatted output ───────────────────────────────────────────
export function header(text: string) {
  console.log("");
  console.log(`  ${c.bold}${text}${c.reset}`);
  console.log(`  ${"─".repeat(text.length + 4)}`);
}

export function scoreBox(score: number, grade: string) {
  const gc = gradeColor(grade);
  console.log("");
  console.log(`  ${gc}╔══════════════════════════════╗${c.reset}`);
  console.log(`  ${gc}║  ${c.bold}DESLOPPIFY SCORE:  ${String(score).padStart(3)}${c.reset}${gc}       ║${c.reset}`);
  console.log(`  ${gc}║  ${c.bold}GRADE: ${grade.padEnd(22)}${c.reset}${gc}  ║${c.reset}`);
  console.log(`  ${gc}╚══════════════════════════════╝${c.reset}`);
}

export function severitySummary(summary: { critical: number; high: number; medium: number; low: number }) {
  const total = summary.critical + summary.high + summary.medium + summary.low;
  if (total === 0) {
    console.log(`\n  ${c.green}${c.bold}No issues found!${c.reset} Your code is clean.\n`);
    return;
  }

  console.log("");
  const parts: string[] = [];
  if (summary.critical > 0) parts.push(`${c.red}${c.bold}${summary.critical} critical${c.reset}`);
  if (summary.high > 0) parts.push(`${c.yellow}${c.bold}${summary.high} high${c.reset}`);
  if (summary.medium > 0) parts.push(`${c.cyan}${summary.medium} medium${c.reset}`);
  if (summary.low > 0) parts.push(`${c.dim}${summary.low} low${c.reset}`);
  console.log(`  ${c.bold}${total} issues${c.reset}  ${parts.join("  ")}`);
}

export function categoryTable(categories: Record<string, { count: number; fixable: number }>) {
  const sorted = Object.entries(categories).sort((a, b) => b[1].count - a[1].count);
  if (sorted.length === 0) return;

  console.log("");
  console.log(`  ${c.bold}Category${c.reset}${"".padEnd(20)}${c.bold}Issues${c.reset}  ${c.bold}Fixable${c.reset}`);
  console.log(`  ${"─".repeat(48)}`);

  const maxCount = Math.max(...sorted.map(([, v]) => v.count));
  for (const [cat, data] of sorted) {
    const gauge ="█".repeat(Math.max(1, Math.round((data.count / maxCount) * 12)));
    const barColor = data.count > 10 ? c.red : data.count > 5 ? c.yellow : c.green;
    console.log(
      `  ${cat.padEnd(26)} ${String(data.count).padStart(4)}   ${String(data.fixable).padStart(4)}   ${barColor}${gauge}${c.reset}`
    );
  }
}

import type { Issue } from "./types";

export function issueList(issues: Issue[], { limit = 20, groupBy = "severity" }: { limit?: number; groupBy?: string } = {}) {
  console.log("");

  if (groupBy === "severity") {
    for (const sev of ["CRITICAL", "HIGH", "MEDIUM", "LOW"]) {
      const sevIssues = issues.filter((i) => i.severity === sev);
      if (sevIssues.length === 0) continue;

      console.log(`  ${severityBadge(sev)} ${c.dim}(${sevIssues.length})${c.reset}`);
      const shown = sevIssues.slice(0, sev === "CRITICAL" || sev === "HIGH" ? 50 : limit);
      for (const issue of shown) {
        const relFile = issue.file.replace(process.cwd() + "/", "");
        console.log(`    ${c.dim}${issue.id}${c.reset} ${relFile}${c.dim}:${issue.line}${c.reset}`);
        console.log(`    ${issue.message}`);
        if (issue.fix) console.log(`    ${c.green}fix: ${issue.fix}${c.reset}`);
        console.log("");
      }
      if (sevIssues.length > shown.length) {
        console.log(`    ${c.dim}... and ${sevIssues.length - shown.length} more${c.reset}\n`);
      }
    }
  } else {
    // Group by category
    const cats = new Map<string, Issue[]>();
    for (const issue of issues) {
      if (!cats.has(issue.category)) cats.set(issue.category, []);
      cats.get(issue.category)!.push(issue);
    }

    for (const [cat, catIssues] of [...cats.entries()].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ${c.bold}${cat}${c.reset} ${c.dim}(${catIssues.length})${c.reset}`);
      const shown = catIssues.slice(0, limit);
      for (const issue of shown) {
        const relFile = issue.file.replace(process.cwd() + "/", "");
        console.log(`    ${severityColor(issue.severity)}${issue.severity.charAt(0)}${c.reset} ${c.dim}${issue.id}${c.reset} ${relFile}${c.dim}:${issue.line}${c.reset}`);
        console.log(`      ${issue.message}`);
      }
      if (catIssues.length > shown.length) {
        console.log(`    ${c.dim}... and ${catIssues.length - shown.length} more${c.reset}`);
      }
      console.log("");
    }
  }
}

export function toolStatus(tools: Record<string, boolean>) {
  const active = Object.entries(tools).filter(([, v]) => v).map(([k]) => k);
  const inactive = Object.entries(tools).filter(([, v]) => !v).map(([k]) => k);
  const activeStr = active.map((t) => `${c.green}${t}${c.reset}`).join(", ");
  const inactiveStr = inactive.length > 0 ? `  ${c.dim}unavailable: ${inactive.join(", ")}${c.reset}` : "";
  console.log(`  ${c.dim}tools:${c.reset} ${activeStr}${inactiveStr}`);
}

export function footer(elapsed: number, fileCount: number) {
  console.log(`  ${c.dim}scanned ${fileCount} files in ${(elapsed / 1000).toFixed(1)}s${c.reset}`);
  console.log("");
}

export { c };

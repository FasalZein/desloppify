import { defineCommand } from "citty";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "path";
import type { Category, ScanReport, Severity } from "../types";

export default defineCommand({
  meta: { name: "worktrees", description: "Show triage summary from saved findings or print worktree setup commands for chosen categories" },
  args: {
    path: { type: "positional", description: "Path to project", default: "." },
    categories: { type: "string", description: "Comma-separated categories (default: all with issues)" },
  },
  run({ args }) {
    const targetPath = resolve(args.path);
    const findingsPath = join(targetPath, ".desloppify", "reports", "latest.findings.json");
    const report = loadReport(findingsPath);

    if (!report) {
      console.error(`No saved findings at ${findingsPath}`);
      console.error(`Run: desloppify scan ${targetPath}`);
      process.exit(1);
    }

    const triage = buildWorktreeTriagePlan(report);

    if (!args.categories) {
      console.log("# Desloppify worktree triage");
      console.log(`# Saved findings: ${findingsPath}`);
      console.log(`# Pack: ${report.scan.pack.name}`);
      console.log("");
      for (const item of triage) {
        console.log(`# ${item.category}`);
        console.log(`- findings: ${item.count}`);
        console.log(`- fixable: ${item.fixable}`);
        console.log(`- highest severity: ${item.highestSeverity.toLowerCase()}`);
        console.log("");
      }
      console.log(`# Next: desloppify worktrees ${targetPath} --categories ${triage.map((item) => item.category).join(",")}`);
      return;
    }

    const selected = args.categories.split(",").map((c: string) => c.trim()).filter(Boolean);
    const valid = new Set(triage.map((item) => item.category));
    const cats = selected.filter((category) => valid.has(category as Category));

    if (cats.length === 0) {
      console.error(`No matching categories in saved findings: ${selected.join(", ")}`);
      console.error(`Available: ${triage.map((item) => item.category).join(", ")}`);
      process.exit(1);
    }

    const branchName = getCurrentBranch(targetPath) ?? "main";
    const packArg = ` --pack ${report.scan.pack.name}`;

    console.log("# Desloppify worktree setup");
    console.log("# Run these commands to create isolated worktrees for each fix category");
    console.log(`# Saved findings: ${findingsPath}`);
    console.log("");

    for (const cat of cats) {
      const branchName = `fix/${cat}`;
      const worktreePath = `${targetPath}/../${cat}-worktree`;
      console.log(`# ${cat}`);
      console.log(`git worktree add -b ${branchName} "${worktreePath}"`);
      console.log(`cd "${worktreePath}" && desloppify scan . --category ${cat}${packArg}`);
      console.log(`cd "${worktreePath}" && desloppify fix . --safe --dry-run`);
      console.log("");
    }

    console.log("# After all agents complete, merge:");
    console.log(`git checkout ${branchName}`);
    for (const cat of cats) {
      console.log(`git merge fix/${cat}`);
    }
    console.log("git worktree prune");
  },
});

interface TriageItem {
  category: Category;
  count: number;
  fixable: number;
  highestSeverity: Severity;
}

function loadReport(findingsPath: string): ScanReport | null {
  if (!existsSync(findingsPath)) return null;

  try {
    return JSON.parse(readFileSync(findingsPath, "utf8")) as ScanReport;
  } catch {
    return null;
  }
}

function buildWorktreeTriagePlan(report: ScanReport): TriageItem[] {
  const order: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  const byCategory = new Map<Category, TriageItem>();

  for (const finding of report.findings) {
    const current = byCategory.get(finding.category);
    const summary = report.categories[finding.category];
    if (!current) {
      byCategory.set(finding.category, {
        category: finding.category,
        count: summary?.count ?? 1,
        fixable: summary?.fixable ?? (finding.fixes?.length ? 1 : 0),
        highestSeverity: finding.severity,
      });
      continue;
    }

    if (order.indexOf(finding.severity) < order.indexOf(current.highestSeverity)) {
      current.highestSeverity = finding.severity;
    }
  }

  return [...byCategory.values()].sort((a, b) => {
    const severityDiff = order.indexOf(a.highestSeverity) - order.indexOf(b.highestSeverity);
    if (severityDiff !== 0) return severityDiff;
    if (b.count !== a.count) return b.count - a.count;
    return a.category.localeCompare(b.category);
  });
}

function getCurrentBranch(cwd: string): string | null {
  const result = Bun.spawnSync(["git", "branch", "--show-current"], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) return null;
  const branch = result.stdout.toString().trim();
  return branch.length > 0 ? branch : null;
}

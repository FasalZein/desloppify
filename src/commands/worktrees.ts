import { defineCommand } from "citty";
import { resolve } from "path";
import type { ScanDeltaReport } from "../scan-delta";
import { getScanWorkflowArtifacts, loadSavedJsonArtifact } from "../scan-workflow";
import type { Category, ScanReport, Severity } from "../types";

export default defineCommand({
  meta: { name: "worktrees", description: "Show triage summary from saved findings or print worktree setup commands for chosen categories" },
  args: {
    path: { type: "positional", description: "Path to project", default: "." },
    categories: { type: "string", description: "Comma-separated categories (default: all with issues)" },
  },
  run({ args }) {
    const targetPath = resolve(args.path);
    const artifacts = getScanWorkflowArtifacts(targetPath);
    const report = loadReport(artifacts.findingsJson);
    const delta = loadDeltaReport(artifacts.deltaJson);

    if (!report) {
      console.error(`No saved findings at ${artifacts.findingsJson}`);
      console.error(`Run: desloppify scan ${targetPath}`);
      process.exit(1);
    }

    const triage = buildWorktreeTriagePlan(report, delta);

    if (!args.categories) {
      console.log("# Desloppify worktree triage");
      console.log(`# Saved findings: ${artifacts.findingsJson}`);
      console.log(`# Pack: ${report.scan.pack.name}`);
      if (delta) console.log(`# Delta report: ${artifacts.deltaJson}`);
      console.log("");
      for (const item of triage) {
        console.log(`# ${item.category}`);
        console.log(`- findings: ${item.count}`);
        console.log(`- fixable: ${item.fixable}`);
        console.log(`- highest severity: ${item.highestSeverity.toLowerCase()}`);
        if (delta) {
          console.log(`- new findings: ${item.newCount}`);
          console.log(`- new blockers: ${item.newBlockingCount}`);
          console.log(`- resolved/improved: ${item.resolvedCount}`);
        }
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
    console.log(`# Saved findings: ${artifacts.findingsJson}`);
    if (delta) console.log(`# Delta report: ${artifacts.deltaJson}`);
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
  newCount: number;
  newBlockingCount: number;
  resolvedCount: number;
}

function loadReport(findingsPath: string): ScanReport | undefined {
  return loadSavedJsonArtifact<ScanReport>(findingsPath);
}

function loadDeltaReport(deltaPath: string): ScanDeltaReport | undefined {
  return loadSavedJsonArtifact<ScanDeltaReport>(deltaPath);
}

function buildWorktreeTriagePlan(report: ScanReport, delta?: ScanDeltaReport | null): TriageItem[] {
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
        newCount: 0,
        newBlockingCount: 0,
        resolvedCount: 0,
      });
      continue;
    }

    if (order.indexOf(finding.severity) < order.indexOf(current.highestSeverity)) {
      current.highestSeverity = finding.severity;
    }
  }

  if (delta) {
    for (const change of delta.changes) {
      const category = change.head?.category ?? change.base?.category;
      if (!category) continue;
      const current = byCategory.get(category as Category);
      if (!current) continue;

      if (change.status === "added" || change.status === "worsened") {
        current.newCount++;
        const severity = change.head?.severity;
        if (severity === "CRITICAL" || severity === "HIGH") current.newBlockingCount++;
      }
      if (change.status === "resolved" || change.status === "improved") {
        current.resolvedCount++;
      }
    }
  }

  return [...byCategory.values()].sort((a, b) => {
    if (b.newBlockingCount !== a.newBlockingCount) return b.newBlockingCount - a.newBlockingCount;
    if (b.newCount !== a.newCount) return b.newCount - a.newCount;
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

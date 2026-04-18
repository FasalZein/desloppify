import { defineCommand } from "citty";
import { existsSync } from "node:fs";
import { join, resolve } from "path";

const CATEGORIES = [
  "dead-code",
  "weak-types",
  "ai-slop",
  "circular-deps",
  "duplication",
  "defensive-programming",
  "legacy-code",
  "type-fragmentation",
  "inconsistency",
  "complexity",
  "security-slop",
  "test-quality",
  "async-correctness",
  "runtime-validation",
  "accessibility",
  "naming-semantics",
];

export default defineCommand({
  meta: { name: "worktrees", description: "Print git worktree setup commands for fix sub-agents" },
  args: {
    path: { type: "positional", description: "Path to project", default: "." },
    categories: { type: "string", description: "Comma-separated categories (default: all with issues)" },
  },
  run({ args }) {
    const targetPath = resolve(args.path);
    const cats = args.categories
      ? args.categories.split(",").map((c: string) => c.trim())
      : CATEGORIES;
    const findingsPath = join(targetPath, ".desloppify", "reports", "latest.findings.json");
    const branchName = getCurrentBranch(targetPath) ?? "main";

    console.log("# Desloppify worktree setup");
    console.log("# Run these commands to create isolated worktrees for each fix category");
    if (existsSync(findingsPath)) {
      console.log(`# Saved findings: ${findingsPath}`);
    }
    console.log("");

    for (const cat of cats) {
      const branchName = `fix/${cat}`;
      const worktreePath = `${targetPath}/../${cat}-worktree`;
      console.log(`# ${cat}`);
      console.log(`git worktree add -b ${branchName} "${worktreePath}"`);
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

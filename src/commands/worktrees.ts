import { defineCommand } from "citty";
import { resolve } from "path";

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

    console.log("# Desloppify worktree setup");
    console.log("# Run these commands to create isolated worktrees for each fix category");
    console.log("");

    for (const cat of cats) {
      const branchName = `fix/${cat}`;
      const worktreePath = `${targetPath}/../${cat}-worktree`;
      console.log(`# ${cat}`);
      console.log(`git worktree add -b ${branchName} "${worktreePath}"`);
      console.log("");
    }

    console.log("# After all agents complete, merge:");
    console.log("git checkout main");
    for (const cat of cats) {
      console.log(`git merge fix/${cat}`);
    }
    console.log("git worktree prune");
  },
});

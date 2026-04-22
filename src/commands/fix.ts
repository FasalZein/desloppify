import { defineCommand } from "citty";
import { existsSync } from "fs";
import { join, resolve } from "path";
import type { Issue, Tier, ToolStatus } from "../types";
import { detectTools } from "../tools";
import { resolveToolCommand } from "../tool-command";
import { walkFiles } from "../analyzers/file-walker";
import { runAstGrep } from "../analyzers/ast-grep";
import { runBuiltinTextAnalyzers } from "../analyzer-registry";
import { runKnip } from "../analyzers/knip";
import { runMadge } from "../analyzers/madge";
import { runTsc } from "../analyzers/tsc";

export default defineCommand({
  meta: { name: "fix", description: "Auto-fix issues by safety tier" },
  args: {
    path: { type: "positional", description: "Path to fix", default: "." },
    safe: { type: "boolean", description: "Tier 1 only: mechanical fixes" },
    confident: { type: "boolean", description: "Tiers 1-2: AST-validated" },
    all: { type: "boolean", description: "Tiers 1-3: cross-file fixes" },
    "dry-run": { type: "boolean", description: "Show what would be fixed without changing files" },
  },
  async run({ args }) {
    const targetPath = resolve(args.path);
    let maxTier: Tier = 1;
    if (args.confident) maxTier = 2;
    if (args.all) maxTier = 3;
    const dryRun = args["dry-run"] ?? false;

    if (!dryRun) {
      const checkpoint = gitCheckpoint(targetPath);
      if (checkpoint) {
        console.log(`Checkpoint created: ${checkpoint}`);
      } else {
        console.log("Warning: Could not create git checkpoint (not a git repo?)");
      }
    }

    const tools = detectTools(targetPath);
    const nets: string[] = ["git"];
    if (tools.tsc) nets.push("tsc");
    if (tools.eslint) nets.push("eslint");
    if (tools.biome) nets.push("biome");
    if (tools.oxlint) nets.push("oxlint");
    if (tools.oxfmt) nets.push("oxfmt");
    if (tools.ruff) nets.push("ruff");
    if (tools["cargo-clippy"]) nets.push("cargo-clippy");
    if (tools.rubocop) nets.push("rubocop");

    console.log(`Safety nets: ${nets.join(", ")}`);
    console.log(`Max tier: ${maxTier}`);
    console.log("");

    const allIssues: Issue[] = [];
    const entries = await walkFiles(targetPath);
    allIssues.push(...runBuiltinTextAnalyzers(entries, { ids: ["grep-patterns"] }));
    const tasks: Promise<Issue[]>[] = [];

    if (tools["ast-grep"]) tasks.push(runAstGrep(targetPath).then((result) => result.issues));
    if (tools.knip && maxTier >= 3) tasks.push(runKnip(targetPath).then((result) => result.issues));
    if (tools.madge && maxTier >= 3) tasks.push(runMadge(targetPath).then((result) => result.issues));
    if (tools.tsc && maxTier >= 3) tasks.push(runTsc(targetPath).then((result) => result.issues));

    const results = await Promise.all(tasks);
    for (const issues of results) allIssues.push(...issues);

    // Filter to fixable issues within tier
    const fixable = allIssues.filter(
      (i) => i.tier > 0 && i.tier <= maxTier && i.fix
    );

    if (fixable.length === 0) {
      console.log("No fixable issues found at this tier.");
      process.exit(0);
    }

    console.log(`Found ${fixable.length} fixable issues (tier 1-${maxTier})`);
    console.log("");

    if (dryRun) {
      for (const issue of fixable) {
        console.log(
          `[T${issue.tier}] ${issue.id} ${issue.file}:${issue.line} — ${issue.fix}`
        );
      }
      process.exit(0);
    }

    let applied = 0;
    let skipped = 0;

    for (let tier = 1 as Tier; tier <= maxTier; tier++) {
      const tierIssues = fixable.filter((i) => i.tier === tier);
      if (tierIssues.length === 0) continue;

      console.log(`--- Tier ${tier} (${tierIssues.length} issues) ---`);

      for (const issue of tierIssues) {
        const success = await applyFix(issue);
        if (success) {
          applied++;
          console.log(`  Fixed: ${issue.id} ${issue.file}:${issue.line}`);
        } else {
          skipped++;
          console.log(`  Skipped: ${issue.id} ${issue.file}:${issue.line}`);
        }
      }

      // Validate after each tier
      if (tier >= 2 && tools.tsc) {
        const tscResult = Bun.spawnSync([resolveToolCommand(targetPath, "tsc"), "--noEmit"], {
          cwd: targetPath,
          stdout: "pipe",
          stderr: "pipe",
          timeout: 120_000,
        });
        if (tscResult.exitCode !== 0) {
          console.log(`\nType check failed after tier ${tier}. Reverting tier.`);
          Bun.spawnSync(["git", "checkout", "."], { cwd: targetPath });
          skipped += tierIssues.length;
          applied -= tierIssues.length;
          continue;
        }
      }
    }

    if (applied > 0) {
      const formatterRuns = runPostFixFormatters(targetPath, tools);
      if (formatterRuns.length > 0) {
        console.log("");
        console.log(`Formatters: ${formatterRuns.join(", ")}`);
      }
    }

    console.log("");
    console.log(`Applied: ${applied} | Skipped: ${skipped}`);
    process.exit(applied > 0 ? 0 : 1);
  },
});

function runPostFixFormatters(targetPath: string, tools: ToolStatus): string[] {
  const ran: string[] = [];

  if (tools.biome && hasAnyFile(targetPath, ["biome.json", "biome.jsonc"])) {
    const result = Bun.spawnSync([resolveToolCommand(targetPath, "biome"), "format", "--write", "."], {
      cwd: targetPath,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120_000,
    });
    if (result.exitCode === 0) ran.push("biome format");
  }

  if (tools.oxfmt && existsSync(join(targetPath, "package.json"))) {
    const result = Bun.spawnSync([resolveToolCommand(targetPath, "oxfmt"), "--write", "."], {
      cwd: targetPath,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120_000,
    });
    if (result.exitCode === 0) ran.push("oxfmt");
  }

  if (tools.ruff && hasAnyFile(targetPath, ["pyproject.toml", "ruff.toml", ".ruff.toml"])) {
    const result = Bun.spawnSync(["ruff", "format", "."], {
      cwd: targetPath,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120_000,
    });
    if (result.exitCode === 0) ran.push("ruff format");
  }

  return ran;
}

function hasAnyFile(rootPath: string, names: string[]): boolean {
  return names.some((name) => existsSync(join(rootPath, name)));
}

function gitCheckpoint(cwd: string): string | null {
  // Check if in a git repo
  const check = Bun.spawnSync(["git", "rev-parse", "--git-dir"], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (check.exitCode !== 0) return null;

  const ts = Math.floor(Date.now() / 1000);
  const tag = `desloppify-checkpoint-${ts}`;

  // Stash any uncommitted changes as a safety net
  Bun.spawnSync(["git", "stash", "push", "-m", tag], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  // Pop it back immediately — the stash entry stays in the reflog
  Bun.spawnSync(["git", "stash", "pop"], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  // Create an actual checkpoint tag on current HEAD
  const result = Bun.spawnSync(["git", "tag", tag], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  return result.exitCode === 0 ? tag : null;
}

async function applyFix(issue: Issue): Promise<boolean> {
  if (issue.tier === 1 && isRemovalFix(issue.id)) {
    return removeLine(issue.file, issue.line);
  }
  if (issue.tier === 1 && issue.id === "RETURN_UNDEFINED") {
    return rewriteLine(issue.file, issue.line, (line) => line.replace(/return\s+undefined\s*;/, "return;"));
  }
  if (issue.tier === 1 && issue.id === "EXPLICIT_TRUE_COMPARE") {
    return rewriteLine(issue.file, issue.line, simplifyBooleanComparison);
  }

  // Tier 2+ fixes need AST-aware transforms — flag for agent to handle
  return false;
}

function isRemovalFix(ruleId: string): boolean {
  return [
    "BANNER_COMMENT",
    "NARRATION_COMMENT",
    "APOLOGETIC_COMMENT",
    "OBVIOUS_JSX_LABEL",
    "CONSOLE_LOG",
  ].includes(ruleId);
}

async function removeLine(filePath: string, lineNum: number): Promise<boolean> {
  return rewriteFileLines(filePath, lineNum, (lines, index) => {
    lines.splice(index, 1);
    return true;
  });
}

async function rewriteLine(filePath: string, lineNum: number, transform: (line: string) => string): Promise<boolean> {
  return rewriteFileLines(filePath, lineNum, (lines, index) => {
    const next = transform(lines[index] ?? "");
    if (next === lines[index]) return false;
    lines[index] = next;
    return true;
  });
}

async function rewriteFileLines(filePath: string, lineNum: number, mutate: (lines: string[], index: number) => boolean): Promise<boolean> {
  try {
    const file = Bun.file(filePath);
    const content = await file.text();
    const lines = content.split("\n");
    const index = lineNum - 1;

    if (index < 0 || index >= lines.length) return false;
    const changed = mutate(lines, index);
    if (!changed) return false;

    await Bun.write(filePath, lines.join("\n"));
    return true;
  } catch {
    return false;
  }
}

function simplifyBooleanComparison(line: string): string {
  return line
    .replace(/\b(\w+)\s*===?\s*true\b/g, "$1")
    .replace(/\b(\w+)\s*===?\s*false\b/g, "!$1");
}

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

let tempRoot: string | undefined;

afterEach(() => {
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = undefined;
});

const run = (args: string[]) => Bun.spawnSync(["bun", "src/cli.ts", "worktrees", ...args], {
  cwd: process.cwd(),
  stdout: "pipe",
  stderr: "pipe",
});

describe("worktrees command", () => {
  test("errors when no saved findings are present", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-worktrees-missing-"));

    const result = run([tempRoot]);
    const error = result.stderr.toString();

    expect(result.exitCode).toBe(1);
    expect(error).toContain("No saved findings");
    expect(error).toContain("Run: desloppify scan");
  });

  test("shows triage summary from saved findings by default", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-worktrees-"));
    mkdirSync(join(tempRoot, ".desloppify", "reports"), { recursive: true });
    writeFileSync(join(tempRoot, ".desloppify", "reports", "latest.findings.json"), JSON.stringify({
      scan: { pack: { name: "js-ts" } },
      categories: {
        "ai-slop": { count: 2, fixable: 1 },
        complexity: { count: 1, fixable: 0 },
      },
      findings: [
        { category: "ai-slop", severity: "MEDIUM" },
        { category: "complexity", severity: "HIGH" },
        { category: "ai-slop", severity: "LOW" },
      ],
    }));

    const result = run([tempRoot]);
    const output = result.stdout.toString();

    expect(result.exitCode).toBe(0);
    expect(output).toContain("# Desloppify worktree triage");
    expect(output).toContain("# complexity");
    expect(output).toContain("- findings: 1");
    expect(output).toContain("- highest severity: high");
    expect(output).toContain("# ai-slop");
    expect(output).toContain("- fixable: 1");
    expect(output).toContain(`desloppify worktrees ${tempRoot} --categories complexity,ai-slop`);
    expect(output).not.toContain("git worktree add -b fix/weak-types");
  });

  test("prints setup commands for selected categories", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-worktrees-selected-"));
    mkdirSync(join(tempRoot, ".desloppify", "reports"), { recursive: true });
    writeFileSync(join(tempRoot, ".desloppify", "reports", "latest.findings.json"), JSON.stringify({
      scan: { pack: { name: "js-ts" } },
      findings: [
        { category: "ai-slop", severity: "MEDIUM" },
        { category: "complexity", severity: "HIGH" },
      ],
      categories: {
        "ai-slop": { count: 1, fixable: 1 },
        complexity: { count: 1, fixable: 0 },
      },
    }));

    const result = run([tempRoot, "--categories", "ai-slop,complexity"]);
    const output = result.stdout.toString();

    expect(result.exitCode).toBe(0);
    expect(output).toContain("git worktree add -b fix/ai-slop");
    expect(output).toContain(`cd \"${tempRoot}/../ai-slop-worktree\" && desloppify scan . --category ai-slop --pack js-ts`);
    expect(output).toContain("git merge fix/complexity");
  });

  test("prioritizes categories with new blockers from delta", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-worktrees-delta-"));
    mkdirSync(join(tempRoot, ".desloppify", "reports"), { recursive: true });
    writeFileSync(join(tempRoot, ".desloppify", "reports", "latest.findings.json"), JSON.stringify({
      scan: { pack: { name: "js-ts" } },
      findings: [
        { category: "ai-slop", severity: "MEDIUM" },
        { category: "complexity", severity: "HIGH" },
      ],
      categories: {
        "ai-slop": { count: 1, fixable: 1 },
        complexity: { count: 1, fixable: 0 },
      },
    }));
    writeFileSync(join(tempRoot, ".desloppify", "reports", "latest.delta.json"), JSON.stringify({
      summary: { addedCount: 1, resolvedCount: 1, worsenedCount: 0, improvedCount: 0 },
      changes: [
        { status: "added", head: { category: "ai-slop", severity: "HIGH" } },
        { status: "resolved", base: { category: "complexity", severity: "HIGH" } },
      ],
    }));

    const result = run([tempRoot]);
    const output = result.stdout.toString();

    expect(result.exitCode).toBe(0);
    expect(output).toContain("# Delta report:");
    expect(output).toContain("- new findings: 1");
    expect(output).toContain("- new blockers: 1");
    expect(output).toContain("- resolved/improved: 1");
    expect(output.indexOf("# ai-slop")).toBeLessThan(output.indexOf("# complexity"));
    expect(output).toContain(`desloppify worktrees ${tempRoot} --categories ai-slop,complexity`);
  });
});

import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

let tempRoot: string | undefined;

afterEach(() => {
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = undefined;
});

const runCli = (args: string[]) => Bun.spawnSync(["bun", "src/cli.ts", ...args], {
  cwd: process.cwd(),
  stdout: "pipe",
  stderr: "pipe",
});

function createFixtureRepo() {
  tempRoot = mkdtempSync(join(tmpdir(), "desloppify-workflow-"));
  mkdirSync(join(tempRoot, "src"), { recursive: true });
  writeFileSync(join(tempRoot, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0" }));
  writeFileSync(join(tempRoot, "src", "bad.ts"), [
    "// ====================",
    'console.log("debug");',
    "export const ready = true;",
    "",
  ].join("\n"));
  return tempRoot;
}

describe("workflow e2e", () => {
  test("scan writes artifacts, fix dry-run is non-mutating, and worktrees turns findings into triage then commands", () => {
    const repo = createFixtureRepo();

    const scan = runCli(["scan", repo, "--pack", "js-ts", "--category", "ai-slop"]);
    expect(scan.exitCode).toBe(1);
    expect(existsSync(join(repo, ".desloppify", "reports", "latest.findings.json"))).toBe(true);
    expect(existsSync(join(repo, ".desloppify", "reports", "latest.report.md"))).toBe(true);

    const before = readFileSync(join(repo, "src", "bad.ts"), "utf8");
    const fix = runCli(["fix", repo, "--safe", "--dry-run"]);
    const after = readFileSync(join(repo, "src", "bad.ts"), "utf8");
    expect(fix.exitCode).toBe(0);
    expect(fix.stdout.toString()).toContain("BANNER_COMMENT");
    expect(before).toBe(after);

    const triage = runCli(["worktrees", repo]);
    const triageOutput = triage.stdout.toString();
    expect(triage.exitCode).toBe(0);
    expect(triageOutput).toContain("# Desloppify worktree triage");
    expect(triageOutput).toContain("# ai-slop");
    expect(triageOutput).toContain("- findings: 1");
    expect(triageOutput).toContain(`desloppify worktrees ${repo} --categories ai-slop`);

    const worktrees = runCli(["worktrees", repo, "--categories", "ai-slop"]);
    const output = worktrees.stdout.toString();
    expect(worktrees.exitCode).toBe(0);
    expect(output).toContain("git worktree add -b fix/ai-slop");
    expect(output).toContain("desloppify scan . --category ai-slop --pack js-ts");
    expect(output).toContain("desloppify fix . --safe --dry-run");
    expect(output).not.toContain("git worktree add -b fix/async-correctness");
  });
});

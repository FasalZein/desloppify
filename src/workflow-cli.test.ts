import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function createTempRepo() {
  const root = mkdtempSync(join(tmpdir(), "desloppify-workflow-"));
  tempRoots.push(root);

  Bun.spawnSync(["git", "init", "-q", root], { stdout: "pipe", stderr: "pipe" });
  Bun.spawnSync(["git", "-C", root, "config", "user.email", "test@example.com"], { stdout: "pipe", stderr: "pipe" });
  Bun.spawnSync(["git", "-C", root, "config", "user.name", "Desloppify Test"], { stdout: "pipe", stderr: "pipe" });

  const filePath = join(root, "src", "example.ts");
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(filePath, 'console.log("hi")\n', "utf8");
  Bun.spawnSync(["git", "-C", root, "add", "."], { stdout: "pipe", stderr: "pipe" });
  Bun.spawnSync(["git", "-C", root, "commit", "-qm", "init"], { stdout: "pipe", stderr: "pipe" });

  return { root, filePath };
}

function runCli(args: string[], cwd = process.cwd()) {
  return Bun.spawnSync(["bun", "src/cli.ts", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NO_COLOR: "1", CI: "1", COLUMNS: "240" },
  });
}

function stripAnsi(text: string) {
  return text.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

function squashWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

describe("CLI workflow", () => {
  test("scan writes workflow artifacts for a temp repo", () => {
    const { root } = createTempRepo();

    const result = runCli(["scan", root, "--pack", "js-ts"]);
    const output = squashWhitespace(stripAnsi(result.stdout.toString()));
    const findingsPath = join(root, ".desloppify", "reports", "latest.findings.json");
    const reportPath = join(root, ".desloppify", "reports", "latest.report.md");
    const wikiPath = join(root, ".desloppify", "reports", "latest.wiki.json");
    const handoffPath = join(root, ".desloppify", "reports", "latest.handoff.md");

    expect(result.exitCode).toBe(1);
    expect(output).toContain("Findings JSON:");
    expect(output).toContain("Readable report:");
    expect(existsSync(findingsPath)).toBe(true);
    expect(existsSync(reportPath)).toBe(true);
    expect(existsSync(wikiPath)).toBe(true);
    expect(existsSync(handoffPath)).toBe(true);
    expect(readFileSync(findingsPath, "utf8")).toContain("CONSOLE_LOG");
  });

  test("fix --safe --dry-run reports safe fixes without mutating the repo", () => {
    const { root, filePath } = createTempRepo();

    const before = readFileSync(filePath, "utf8");
    const result = runCli(["fix", root, "--safe", "--dry-run"]);
    const output = result.stdout.toString();
    const tags = Bun.spawnSync(["git", "-C", root, "tag"], { stdout: "pipe", stderr: "pipe" }).stdout.toString();

    expect(result.exitCode).toBe(0);
    expect(output).toContain("Found 1 fixable issues");
    expect(output).toContain("[T1] CONSOLE_LOG");
    expect(readFileSync(filePath, "utf8")).toBe(before);
    expect(tags).not.toContain("desloppify-checkpoint-");
  });

  test("worktrees prints current branch merge steps and saved findings path", () => {
    const { root } = createTempRepo();
    runCli(["scan", root, "--pack", "js-ts"]);

    const result = runCli(["worktrees", root, "--categories", "ai-slop,complexity"]);
    const output = squashWhitespace(result.stdout.toString());
    const branch = Bun.spawnSync(["git", "-C", root, "branch", "--show-current"], { stdout: "pipe", stderr: "pipe" }).stdout.toString().trim();

    expect(result.exitCode).toBe(0);
    expect(output).toContain(`# Saved findings: ${join(root, ".desloppify", "reports", "latest.findings.json")}`);
    expect(output).toContain(`git checkout ${branch}`);
    expect(output).toContain("git merge fix/ai-slop");
    expect(output).toContain("git merge fix/complexity");
  });
});

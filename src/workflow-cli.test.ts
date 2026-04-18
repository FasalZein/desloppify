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

function artifactPaths(root: string) {
  return {
    findingsPath: join(root, ".desloppify", "reports", "latest.findings.json"),
    reportPath: join(root, ".desloppify", "reports", "latest.report.md"),
    wikiPath: join(root, ".desloppify", "reports", "latest.wiki.json"),
    handoffPath: join(root, ".desloppify", "reports", "latest.handoff.md"),
  };
}

function expectArtifacts(root: string) {
  const { findingsPath, reportPath, wikiPath, handoffPath } = artifactPaths(root);
  expect(existsSync(findingsPath)).toBe(true);
  expect(existsSync(reportPath)).toBe(true);
  expect(existsSync(wikiPath)).toBe(true);
  expect(existsSync(handoffPath)).toBe(true);
  return { findingsPath, reportPath, wikiPath, handoffPath };
}

describe("CLI workflow", () => {
  test("scan writes workflow artifacts for a temp repo", () => {
    const { root } = createTempRepo();

    const result = runCli(["scan", root, "--pack", "js-ts"]);
    const output = squashWhitespace(stripAnsi(result.stdout.toString()));
    const { findingsPath, wikiPath } = expectArtifacts(root);

    expect(result.exitCode).toBe(1);
    expect(output).toContain("Findings JSON:");
    expect(output).toContain("Readable report:");
    expect(readFileSync(findingsPath, "utf8")).toContain("CONSOLE_LOG");
    const wikiArtifact = JSON.parse(readFileSync(wikiPath, "utf8"));
    expect(wikiArtifact.workflowCommands[0].exec).toEqual({
      command: "cat",
      args: [findingsPath],
    });
    expect(wikiArtifact.workflowCommands[1].exec).toEqual({
      command: "desloppify",
      args: ["worktrees", root],
    });
    expect(wikiArtifact.workflowCommands[2].exec).toBeUndefined();
  });

  test("non-pretty scan modes also persist canonical artifacts", () => {
    const { root } = createTempRepo();

    const json = runCli(["scan", root, "--pack", "js-ts", "--json"]);
    expect(json.exitCode).toBe(1);
    expect(() => JSON.parse(json.stdout.toString())).not.toThrow();
    expectArtifacts(root);

    const markdown = runCli(["scan", root, "--pack", "js-ts", "--markdown"]);
    expect(markdown.exitCode).toBe(1);
    expect(markdown.stdout.toString()).toContain("# Desloppify Report");
    expectArtifacts(root);

    const wiki = runCli(["scan", root, "--pack", "js-ts", "--wiki", "--project", "desloppify"]);
    expect(wiki.exitCode).toBe(1);
    expect(() => JSON.parse(wiki.stdout.toString())).not.toThrow();
    expectArtifacts(root);

    const handoff = runCli(["scan", root, "--pack", "js-ts", "--handoff", "--project", "desloppify", "--slice", "DESLOPPIFY-011"]);
    expect(handoff.exitCode).toBe(1);
    expect(handoff.stdout.toString()).toContain("#");
    expectArtifacts(root);
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

    const result = runCli(["worktrees", root, "--categories", "ai-slop"]);
    const output = squashWhitespace(result.stdout.toString());
    const branch = Bun.spawnSync(["git", "-C", root, "branch", "--show-current"], { stdout: "pipe", stderr: "pipe" }).stdout.toString().trim();

    expect(result.exitCode).toBe(0);
    expect(output).toContain(`# Saved findings: ${join(root, ".desloppify", "reports", "latest.findings.json")}`);
    expect(output).toContain(`git checkout ${branch}`);
    expect(output).toContain("git merge fix/ai-slop");
    expect(output).not.toContain("git merge fix/complexity");
  });
});

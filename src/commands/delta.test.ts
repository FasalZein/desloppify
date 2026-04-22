import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildScanReport } from "../report";
import type { Issue, ToolStatus } from "../types";
import command from "./delta";

let tempRoot: string | undefined;

afterEach(() => {
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = undefined;
});

const tools: ToolStatus = {
  knip: false,
  madge: false,
  "ast-grep": false,
  tsc: false,
  eslint: false,
  biome: false,
};

function issue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "TEST_RULE",
    category: "dead-code",
    severity: "MEDIUM",
    tier: 1,
    file: "/repo/src/example.ts",
    line: 3,
    message: "test issue",
    tool: "grep",
    ...overrides,
  };
}

function writeReport(dir: string, issues: Issue[]) {
  mkdirSync(join(dir, ".desloppify", "reports"), { recursive: true });
  const report = buildScanReport(dir, tools, issues, { name: "js-ts", explicit: true });
  writeFileSync(join(dir, ".desloppify", "reports", "latest.findings.json"), JSON.stringify(report));
}

const run = (args: string[]) => Bun.spawnSync(["bun", "src/cli.ts", "delta", ...args], {
  cwd: process.cwd(),
  stdout: "pipe",
  stderr: "pipe",
});

describe("delta command", () => {
  test("declares report, scope, and fail-on args", () => {
    const source = readFileSync(join(process.cwd(), "src", "commands", "delta.ts"), "utf8");
    expect(source).toContain('name: "delta"');
    expect(command.args).toHaveProperty("base-report");
    expect(command.args).toHaveProperty("head-report");
    expect(command.args).toHaveProperty("markdown");
    expect(command.args).toHaveProperty("comment");
    expect(command.args).toHaveProperty("max-findings");
    expect(command.args).toHaveProperty("category");
    expect(command.args).toHaveProperty("path");
    expect(command.args).toHaveProperty("severity");
    expect(command.args).toHaveProperty("fail-on");
  });

  test("compares saved repo reports via positional paths and prints analytics", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-delta-"));
    const base = join(tempRoot, "base");
    const head = join(tempRoot, "head");
    writeReport(base, [issue({ severity: "LOW", file: "/repo/src/example.ts" })]);
    writeReport(head, [issue({ severity: "HIGH", file: "/repo/src/example.ts" })]);

    const result = run([base, head]);
    const output = result.stdout.toString();

    expect(result.exitCode).toBe(0);
    expect(output).toContain("# Desloppify delta");
    expect(output).toContain("- worsened: 1");
    expect(output).toContain("## Categories");
    expect(output).toContain("dead-code: +0 added, +1 worsened");
    expect(output).toContain("## Paths");
    expect(output).toContain("/repo/src/example.ts: +0 added, +1 worsened");
  });

  test("supports explicit report files, fail-on added,worsened, and json analytics", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-delta-files-"));
    const base = join(tempRoot, "base");
    const head = join(tempRoot, "head");
    writeReport(base, [
      issue({ id: "OLD_RULE", category: "dead-code", file: "/repo/src/legacy.ts" }),
      issue({ id: "UNCHANGED_RULE", category: "complexity", file: "/repo/src/steady.ts" }),
    ]);
    writeReport(head, [
      issue({ id: "NEW_RULE", category: "security-slop", severity: "HIGH", file: "/repo/src/new.ts" }),
      issue({ id: "UNCHANGED_RULE", category: "complexity", file: "/repo/src/steady.ts" }),
    ]);

    const baseReport = join(base, ".desloppify", "reports", "latest.findings.json");
    const headReport = join(head, ".desloppify", "reports", "latest.findings.json");
    const result = run(["--base-report", baseReport, "--head-report", headReport, "--fail-on", "added,worsened", "--json"]);
    const delta = JSON.parse(result.stdout.toString());

    expect(result.exitCode).toBe(1);
    expect(delta.summary.addedCount).toBe(1);
    expect(delta.summary.resolvedCount).toBe(1);
    expect(delta.categories[0].category).toBe("security-slop");
    expect(delta.categories[0].regressionCount).toBe(1);
    expect(delta.paths[0].path).toBe("/repo/src/new.ts");
    expect(delta.paths[0].regressionCount).toBe(1);
  });

  test("scopes fail-on and analytics to one category", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-delta-category-"));
    const base = join(tempRoot, "base");
    const head = join(tempRoot, "head");
    writeReport(base, [issue({ id: "KEEP", category: "dead-code", file: "/repo/src/keep.ts" })]);
    writeReport(head, [
      issue({ id: "KEEP", category: "dead-code", file: "/repo/src/keep.ts" }),
      issue({ id: "NEW_SECURITY", category: "security-slop", severity: "HIGH", file: "/repo/src/security.ts" }),
    ]);

    const result = run([base, head, "--category", "dead-code", "--fail-on", "added,worsened", "--json"]);
    const delta = JSON.parse(result.stdout.toString());

    expect(result.exitCode).toBe(0);
    expect(delta.scope.category).toBe("dead-code");
    expect(delta.summary.addedCount).toBe(0);
    expect(delta.summary.unchangedCount).toBe(1);
    expect(delta.categories).toHaveLength(0);
    expect(delta.paths).toHaveLength(0);
  });

  test("scopes fail-on and analytics to one path glob", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-delta-path-"));
    const base = join(tempRoot, "base");
    const head = join(tempRoot, "head");
    writeReport(base, [issue({ id: "KEEP", category: "dead-code", file: "/repo/src/keep.ts" })]);
    writeReport(head, [
      issue({ id: "KEEP", category: "dead-code", file: "/repo/src/keep.ts" }),
      issue({ id: "NEW_SECURITY", category: "security-slop", severity: "HIGH", file: "/repo/src/security/new.ts" }),
      issue({ id: "NEW_DEAD", category: "dead-code", severity: "HIGH", file: "/repo/src/dead/new.ts" }),
    ]);

    const result = run([base, head, "--path", "**/dead/*.ts", "--fail-on", "added,worsened"]);
    const output = result.stdout.toString();

    expect(result.exitCode).toBe(1);
    expect(output).toContain("Scope: path=**/dead/*.ts");
    expect(output).toContain("- added: 1");
    expect(output).toContain("/repo/src/dead/new.ts: +1 added");
    expect(output).not.toContain("/repo/src/security/new.ts");
  });

  test("scopes fail-on and analytics to selected severities", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-delta-severity-"));
    const base = join(tempRoot, "base");
    const head = join(tempRoot, "head");
    writeReport(base, [issue({ id: "KEEP", severity: "LOW", file: "/repo/src/keep.ts" })]);
    writeReport(head, [
      issue({ id: "KEEP", severity: "LOW", file: "/repo/src/keep.ts" }),
      issue({ id: "NEW_MEDIUM", severity: "MEDIUM", file: "/repo/src/medium.ts" }),
      issue({ id: "NEW_HIGH", severity: "HIGH", file: "/repo/src/high.ts" }),
    ]);

    const result = run([base, head, "--severity", "high,critical", "--fail-on", "added,worsened", "--json"]);
    const delta = JSON.parse(result.stdout.toString());

    expect(result.exitCode).toBe(1);
    expect(delta.scope.severity).toEqual(["HIGH", "CRITICAL"]);
    expect(delta.summary.addedCount).toBe(1);
    expect(delta.paths).toHaveLength(1);
    expect(delta.paths[0].path).toBe("/repo/src/high.ts");
  });

  test("severity scope can suppress lower-severity regressions", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-delta-severity-suppress-"));
    const base = join(tempRoot, "base");
    const head = join(tempRoot, "head");
    writeReport(base, []);
    writeReport(head, [issue({ id: "NEW_MEDIUM", severity: "MEDIUM", file: "/repo/src/medium.ts" })]);

    const result = run([base, head, "--severity", "high,critical", "--fail-on", "added,worsened"]);
    const output = result.stdout.toString();

    expect(result.exitCode).toBe(0);
    expect(output).toContain("Scope: severity=HIGH,CRITICAL");
    expect(output).toContain("- added: 0");
  });

  test("emits regressions-only markdown and saves a markdown artifact", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-delta-markdown-"));
    const base = join(tempRoot, "base");
    const head = join(tempRoot, "head");
    writeReport(base, [
      issue({ id: "KEEP", severity: "LOW", file: "/repo/src/keep.ts" }),
      issue({ id: "RESOLVED_OLD", category: "dead-code", severity: "MEDIUM", file: "/repo/src/old.ts" }),
    ]);
    writeReport(head, [
      issue({ id: "KEEP", severity: "LOW", file: "/repo/src/keep.ts" }),
      issue({ id: "NEW_HIGH", category: "security-slop", severity: "HIGH", file: "/repo/src/high.ts" }),
    ]);

    const result = run([base, head, "--severity", "high,critical", "--markdown"]);
    const output = result.stdout.toString();
    const artifact = join(head, ".desloppify", "reports", "latest.delta.md");

    expect(result.exitCode).toBe(0);
    expect(output).toContain("# Desloppify regressions");
    expect(output).toContain("## Regressions by category");
    expect(output).toContain("security-slop: +1 added, +0 worsened");
    expect(output).not.toContain("resolved");
    expect(existsSync(artifact)).toBe(true);
    expect(readFileSync(artifact, "utf8")).toContain("# Desloppify regressions");
  });

  test("emits compact comment markdown with capped findings and saves a comment artifact", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-delta-comment-"));
    const base = join(tempRoot, "base");
    const head = join(tempRoot, "head");
    writeReport(base, []);
    writeReport(head, [
      issue({ id: "LOW_ONE", severity: "LOW", file: "/repo/src/low.ts" }),
      issue({ id: "HIGH_ONE", category: "security-slop", severity: "HIGH", file: "/repo/src/high.ts" }),
      issue({ id: "CRITICAL_ONE", category: "security-slop", severity: "CRITICAL", file: "/repo/src/critical.ts" }),
    ]);

    const result = run([base, head, "--comment", "--max-findings", "2"]);
    const output = result.stdout.toString();
    const artifact = join(head, ".desloppify", "reports", "latest.delta.comment.md");

    expect(result.exitCode).toBe(0);
    expect(output).toContain("# Desloppify delta comment");
    expect(output).toContain("- Showing: 2/3 regressions");
    expect(output).toContain("[CRITICAL] ADDED CRITICAL_ONE");
    expect(output).toContain("[HIGH] ADDED HIGH_ONE");
    expect(output).not.toContain("LOW_ONE");
    expect(output).toContain("...and 1 more regression(s).");
    expect(existsSync(artifact)).toBe(true);
    expect(readFileSync(artifact, "utf8")).toContain("# Desloppify delta comment");
  });
});

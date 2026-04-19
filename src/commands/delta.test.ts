import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  test("declares report and fail-on args", () => {
    expect(command.meta.name).toBe("delta");
    expect(command.args).toHaveProperty("base-report");
    expect(command.args).toHaveProperty("head-report");
    expect(command.args).toHaveProperty("fail-on");
  });

  test("compares saved repo reports via positional paths", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-delta-"));
    const base = join(tempRoot, "base");
    const head = join(tempRoot, "head");
    writeReport(base, [issue({ severity: "LOW" })]);
    writeReport(head, [issue({ severity: "HIGH" })]);

    const result = run([base, head]);
    const output = result.stdout.toString();

    expect(result.exitCode).toBe(0);
    expect(output).toContain("# Desloppify delta");
    expect(output).toContain("- worsened: 1");
  });

  test("supports explicit report files and fail-on added,worsened", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-delta-files-"));
    const base = join(tempRoot, "base");
    const head = join(tempRoot, "head");
    writeReport(base, [issue({ id: "OLD_RULE" })]);
    writeReport(head, [issue({ id: "NEW_RULE", severity: "HIGH" })]);

    const baseReport = join(base, ".desloppify", "reports", "latest.findings.json");
    const headReport = join(head, ".desloppify", "reports", "latest.findings.json");
    const result = run(["--base-report", baseReport, "--head-report", headReport, "--fail-on", "added,worsened", "--json"]);
    const delta = JSON.parse(result.stdout.toString());

    expect(result.exitCode).toBe(1);
    expect(delta.summary.addedCount).toBe(1);
    expect(delta.summary.resolvedCount).toBe(1);
  });
});

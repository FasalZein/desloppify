import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveScanArtifacts } from "./report-artifacts";
import { buildScanReport } from "./report";
import { buildWikiReport } from "./wiki-output";
import type { Issue, ToolStatus } from "./types";

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

const issues: Issue[] = [
  {
    id: "TEST_RULE",
    category: "dead-code",
    severity: "MEDIUM",
    tier: 1,
    file: "/repo/src/example.ts",
    line: 3,
    message: "test issue",
    tool: "grep",
  },
];

describe("saveScanArtifacts", () => {
  test("writes predictable report files", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-artifacts-"));
    const report = buildScanReport(tempRoot, tools, issues, { name: "js-ts", explicit: true });
    const wiki = buildWikiReport(report, { project: "desloppify" });
    const artifacts = saveScanArtifacts(tempRoot, report, wiki, "# Report", "# Handoff");

    expect(existsSync(artifacts.findingsJson)).toBe(true);
    expect(existsSync(artifacts.reportMarkdown)).toBe(true);
    expect(existsSync(artifacts.wikiJson)).toBe(true);
    expect(existsSync(artifacts.handoffMarkdown)).toBe(true);
    expect(readFileSync(artifacts.reportMarkdown, "utf8")).toContain("# Report");
    expect(readFileSync(artifacts.handoffMarkdown, "utf8")).toContain("# Handoff");
  });
});

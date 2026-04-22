import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSavedScanReport, saveScanArtifacts } from "./report-artifacts";
import { buildScanReport } from "./report";
import { compareScanReports } from "./scan-delta";
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
    expect(loadSavedScanReport(tempRoot)?.findings[0]?.rule_id).toBe("TEST_RULE");
  });

  test("writes a delta artifact when a previous scan exists", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-artifacts-delta-"));
    const base = buildScanReport(tempRoot, tools, issues, { name: "js-ts", explicit: true });
    const baseWiki = buildWikiReport(base, { project: "desloppify" });
    saveScanArtifacts(tempRoot, base, baseWiki, "# Base", "# Handoff");

    const head = buildScanReport(tempRoot, tools, [{ ...issues[0]!, line: 8 }], { name: "js-ts", explicit: true });
    const headWiki = buildWikiReport(head, { project: "desloppify" });
    const delta = compareScanReports(base, head);
    const artifacts = saveScanArtifacts(tempRoot, head, headWiki, "# Head", "# Handoff", delta);

    expect(existsSync(artifacts.deltaJson)).toBe(true);
    expect(readFileSync(artifacts.deltaJson, "utf8")).toContain('"unchangedCount": 1');
  });

  test("adds .desloppify to .gitignore for git repos", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-artifacts-gitignore-"));
    mkdirSync(join(tempRoot, ".git"), { recursive: true });
    writeFileSync(join(tempRoot, ".gitignore"), "node_modules/\n", "utf8");

    const report = buildScanReport(tempRoot, tools, issues, { name: "js-ts", explicit: true });
    const wiki = buildWikiReport(report, { project: "desloppify" });
    saveScanArtifacts(tempRoot, report, wiki, "# Report", "# Handoff");
    saveScanArtifacts(tempRoot, report, wiki, "# Report", "# Handoff");

    expect(readFileSync(join(tempRoot, ".gitignore"), "utf8")).toBe("node_modules/\n.desloppify/\n");
  });
});

import { describe, expect, test } from "bun:test";
import { buildScanReport } from "./report";
import type { Issue, ToolStatus } from "./types";

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

describe("buildScanReport", () => {
  test("normalizes issues into rules, findings, metrics, and hotspots", () => {
    const report = buildScanReport("/repo", tools, issues, { name: "js-ts", explicit: true }, undefined, {
      fileCount: 4,
      lineCount: 40,
      nonEmptyLineCount: 20,
    });

    expect(report.schema_version).toBe("desloppify.findings/v1");
    expect(report.scan.pack).toEqual({ name: "js-ts", explicit: true });
    expect(report.rules.TEST_RULE?.category).toBe("dead-code");
    expect(report.findings[0]?.rule_id).toBe("TEST_RULE");
    expect(report.findings[0]?.locations[0]?.path).toBe("/repo/src/example.ts");
    expect(typeof report.findings[0]?.fingerprints.primary).toBe("string");
    expect(report.metrics.fileCount).toBe(4);
    expect(report.metrics.normalized.findingsPerFile).toBe(0.25);
    expect(report.hotspots.paths[0]).toMatchObject({ path: "/repo/src/example.ts", findingCount: 1 });
  });

  test("dedupes identical issues before building findings", () => {
    const report = buildScanReport("/repo", tools, [issues[0], { ...issues[0] }], { name: "js-ts", explicit: true });

    expect(report.findings).toHaveLength(1);
    expect(report.summary.medium).toBe(1);
  });
});

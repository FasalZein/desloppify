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
  test("normalizes issues into rules and findings", () => {
    const report = buildScanReport("/repo", tools, issues, { name: "js-ts", explicit: true });

    expect(report.schema_version).toBe("desloppify.findings/v1");
    expect(report.scan.pack).toEqual({ name: "js-ts", explicit: true });
    expect(report.rules.TEST_RULE?.category).toBe("dead-code");
    expect(report.findings[0]?.rule_id).toBe("TEST_RULE");
    expect(report.findings[0]?.locations[0]?.path).toBe("/repo/src/example.ts");
    expect(typeof report.findings[0]?.fingerprints.primary).toBe("string");
  });
});

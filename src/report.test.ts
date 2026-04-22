import { describe, expect, test } from "bun:test";
import { buildScanReport, buildScanSummary } from "./report";
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

  test("adds stable partial fingerprints when issues carry delta identity", () => {
    const report = buildScanReport("/repo", tools, [{ ...issues[0]!, deltaIdentity: "ACME" }], { name: "js-ts", explicit: true });

    expect(report.findings[0]?.fingerprints.partial?.path_rule_delta).toBe("/repo/src/example.ts:TEST_RULE:ACME");
    expect(report.findings[0]?.fingerprints.partial?.rule_delta).toBe("TEST_RULE:ACME");
  });

  test("dedupes identical issues before building findings", () => {
    const report = buildScanReport("/repo", tools, [issues[0]!, { ...issues[0]! }], { name: "js-ts", explicit: true });

    expect(report.findings).toHaveLength(1);
    expect(report.summary.medium).toBe(1);
  });

  test("dedupes architecture issues before calculating fit", () => {
    const duplicated = {
      id: "LAYER_BOUNDARY_VIOLATION",
      category: "complexity" as const,
      severity: "HIGH" as const,
      tier: 0 as const,
      file: "/repo/apps/api/src/routes/documents/create.ts",
      line: 1,
      message: "Route imports repository internals",
      tool: "architecture-profile",
    };

    const report = buildScanReport("/repo", tools, [duplicated, { ...duplicated }], { name: "js-ts", explicit: true }, "modular-monolith");

    expect(report.findings).toHaveLength(1);
    expect(report.architecture?.violations.LAYER_BOUNDARY_VIOLATION).toBe(1);
    expect(report.architecture?.fitScore).toBe(88);
  });

  test("builds a compact summary without findings payload", () => {
    const report = buildScanReport("/repo", tools, issues, { name: "js-ts", explicit: true });
    const summary = buildScanSummary(report);

    expect(summary.findingCount).toBe(1);
    expect(summary.ruleCount).toBe(1);
    expect(summary).not.toHaveProperty("findings");
    expect(summary).not.toHaveProperty("rules");
  });

  test("keeps same-line findings distinct when delta identities differ", () => {
    const report = buildScanReport("/repo", tools, [
      { ...issues[0]!, message: "Token literal", deltaIdentity: "ACME" },
      { ...issues[0]!, message: "Token literal", deltaIdentity: "BETA" },
    ], { name: "js-ts", explicit: true });

    expect(report.findings).toHaveLength(2);
  });

  test("preserves explicit columns and ranges while clamping invalid defaults", () => {
    const report = buildScanReport("/repo", tools, [
      { ...issues[0]!, line: 0, column: 0, endLine: 0, endColumn: 0, message: "file-level" },
      { ...issues[0]!, line: 4, column: 7, endLine: 5, endColumn: 9, message: "precise range", deltaIdentity: "range" },
    ], { name: "js-ts", explicit: true });

    expect(report.findings[0]?.locations[0]?.range).toEqual({
      start: { line: 1, column: 1 },
      end: { line: 1, column: 1 },
    });
    expect(report.findings[1]?.locations[0]?.range).toEqual({
      start: { line: 4, column: 7 },
      end: { line: 5, column: 9 },
    });
  });
});

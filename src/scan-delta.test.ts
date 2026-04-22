import { describe, expect, test } from "bun:test";
import { buildScanReport } from "./report";
import { compareScanReports } from "./scan-delta";
import type { Issue, ToolStatus } from "./types";

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

describe("scan delta", () => {
  test("treats identical reports as unchanged", () => {
    const report = buildScanReport("/repo", tools, [issue()], { name: "js-ts", explicit: true });
    const delta = compareScanReports(report, report);

    expect(delta.summary.changed).toBe(false);
    expect(delta.summary.unchangedCount).toBe(1);
    expect(delta.summary.addedCount).toBe(0);
    expect(delta.summary.resolvedCount).toBe(0);
  });

  test("matches line shifts via stable fallback identities", () => {
    const base = buildScanReport("/repo", tools, [issue({ line: 3 })], { name: "js-ts", explicit: true });
    const head = buildScanReport("/repo", tools, [issue({ line: 9 })], { name: "js-ts", explicit: true });
    const delta = compareScanReports(base, head);

    expect(delta.summary.addedCount).toBe(0);
    expect(delta.summary.resolvedCount).toBe(0);
    expect(delta.summary.unchangedCount).toBe(1);
    expect(delta.changes[0]?.matchedBy).toBe("path_rule_message");
  });

  test("matches custom-rule findings by stable delta identity before message fallbacks", () => {
    const base = buildScanReport("/repo", tools, [issue({ line: 3, message: "Contains ACME", deltaIdentity: "ACME" })], { name: "js-ts", explicit: true });
    const head = buildScanReport("/repo", tools, [issue({ line: 9, message: "Contains ACME marker", deltaIdentity: "ACME" })], { name: "js-ts", explicit: true });
    const delta = compareScanReports(base, head);

    expect(delta.summary.addedCount).toBe(0);
    expect(delta.summary.resolvedCount).toBe(0);
    expect(delta.summary.unchangedCount).toBe(1);
    expect(delta.changes[0]?.matchedBy).toBe("path_rule_delta");
  });

  test("classifies severity changes as improved or worsened", () => {
    const base = buildScanReport("/repo", tools, [issue({ severity: "LOW" })], { name: "js-ts", explicit: true });
    const head = buildScanReport("/repo", tools, [issue({ severity: "HIGH" })], { name: "js-ts", explicit: true });
    const worsened = compareScanReports(base, head);
    const improved = compareScanReports(head, base);

    expect(worsened.summary.worsenedCount).toBe(1);
    expect(improved.summary.improvedCount).toBe(1);
  });

  test("surfaces added and resolved findings", () => {
    const base = buildScanReport("/repo", tools, [issue({ id: "OLD_RULE" })], { name: "js-ts", explicit: true });
    const head = buildScanReport("/repo", tools, [issue({ id: "NEW_RULE" })], { name: "js-ts", explicit: true });
    const delta = compareScanReports(base, head);

    expect(delta.summary.addedCount).toBe(1);
    expect(delta.summary.resolvedCount).toBe(1);
  });
});

import { describe, expect, test } from "bun:test";
import type { ScanReport } from "./types";

describe("types", () => {
  test("ScanReport shape supports architecture summaries, metrics, hotspots, and normalized findings", () => {
    const report: ScanReport = {
      schema_version: "desloppify.findings/v1",
      scan: {
        version: "1.0.1",
        path: "/repo",
        generatedAt: "2026-04-16T00:00:00.000Z",
        pack: { name: "js-ts", explicit: true },
      },
      architecture: {
        profile: "modular-monolith",
        fitScore: 80,
        violations: { PRIVATE_MODULE_IMPORT: 1 },
        exemptionsApplied: ["packages/*/index.ts curated public API"],
      },
      tools: {
        knip: true,
        madge: true,
        "ast-grep": true,
        tsc: true,
        eslint: true,
        biome: true,
      },
      score: 95,
      metrics: {
        fileCount: 4,
        lineCount: 40,
        nonEmptyLineCount: 20,
        normalized: {
          scorePerFile: 23.75,
          scorePerKloc: 4750,
          findingsPerFile: 0.25,
          findingsPerKloc: 50,
        },
      },
      hotspots: {
        paths: [{ path: "/repo/src/a.ts", findingCount: 1, penalty: 1 }],
      },
      summary: { critical: 0, high: 0, medium: 0, low: 0 },
      categories: {},
      rules: {
        TEST_RULE: {
          id: "TEST_RULE",
          name: "Test Rule",
          category: "dead-code",
          defaultSeverity: "MEDIUM",
          tool: "grep",
          shortDescription: "summary",
        },
      },
      findings: [
        {
          id: "fp",
          rule_id: "TEST_RULE",
          level: "warning",
          severity: "MEDIUM",
          category: "dead-code",
          message: "test",
          tool: "grep",
          locations: [
            {
              path: "/repo/src/a.ts",
              range: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 1 },
              },
            },
          ],
          primary_location_index: 0,
          fingerprints: { primary: "fp" },
        },
      ],
    };

    expect(report.scan.pack.name).toBe("js-ts");
    expect(report.architecture?.profile).toBe("modular-monolith");
    expect(report.metrics.normalized.findingsPerFile).toBe(0.25);
    expect(report.hotspots.paths[0]?.path).toBe("/repo/src/a.ts");
    expect(report.findings[0]?.rule_id).toBe("TEST_RULE");
  });

  test("pack selection shape supports non-js packs", () => {
    const report: ScanReport = {
      schema_version: "desloppify.findings/v1",
      scan: {
        version: "1.0.1",
        path: "/repo",
        generatedAt: "2026-04-18T00:00:00.000Z",
        pack: { name: "python", explicit: true },
      },
      tools: {
        knip: false,
        madge: false,
        "ast-grep": true,
        tsc: false,
        eslint: false,
        biome: false,
      },
      score: 100,
      metrics: {
        fileCount: 1,
        lineCount: 1,
        nonEmptyLineCount: 1,
        normalized: {
          scorePerFile: 100,
          scorePerKloc: 100000,
          findingsPerFile: 0,
          findingsPerKloc: 0,
        },
      },
      hotspots: { paths: [] },
      summary: { critical: 0, high: 0, medium: 0, low: 0 },
      categories: {},
      rules: {},
      findings: [],
    };

    expect(report.scan.pack.name).toBe("python");
  });
});

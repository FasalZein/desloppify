import { describe, expect, test } from "bun:test";
import type { ScanReport } from "./types";

describe("types", () => {
  test("ScanReport shape supports architecture summaries", () => {
    const report: ScanReport = {
      version: "0.0.1",
      path: "/repo",
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
      summary: { critical: 0, high: 0, medium: 0, low: 0 },
      categories: {},
      issues: [],
    };

    expect(report.architecture?.profile).toBe("modular-monolith");
  });
});

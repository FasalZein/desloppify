import { describe, expect, test } from "bun:test";
import type { BenchmarkSnapshot } from "./types";

describe("benchmark types", () => {
  test("supports benchmark snapshot shapes with normalized ratios", () => {
    const snapshot: BenchmarkSnapshot = {
      schemaVersion: 1,
      benchmarkSetId: "sample",
      benchmarkSetName: "Sample",
      generatedAt: "2026-04-19T00:00:00.000Z",
      analyzerVersion: "1.0.2",
      repos: [
        {
          id: "ai",
          path: "./ai",
          cohort: "explicit-ai",
          pack: "js-ts",
          score: 90,
          summary: { critical: 0, high: 0, medium: 1, low: 0 },
          metrics: {
            fileCount: 1,
            lineCount: 10,
            nonEmptyLineCount: 8,
            normalized: { scorePerFile: 90, scorePerKloc: 11250, findingsPerFile: 1, findingsPerKloc: 125 },
          },
          blendedScore: 1.2,
          ruleCounts: { CONSOLE_LOG: 1 },
          topPaths: [{ path: "./ai/src/example.ts", findingCount: 1, penalty: 1 }],
        },
      ],
      cohorts: {
        "explicit-ai": { repoCount: 1, medians: { scorePerFile: 90, scorePerKloc: 11250, findingsPerFile: 1, findingsPerKloc: 125 }, blendedScoreMedian: 1.2 },
        "mature-oss": { repoCount: 0, medians: { scorePerFile: null, scorePerKloc: null, findingsPerFile: null, findingsPerKloc: null }, blendedScoreMedian: null },
      },
      pairings: [
        {
          aiRepoId: "ai",
          solidRepoId: "oss",
          ratios: { scorePerFile: 1.2, scorePerKloc: 1.1, findingsPerFile: 2, findingsPerKloc: 2 },
        },
      ],
    };

    expect(snapshot.repos[0]?.metrics.normalized.findingsPerFile).toBe(1);
    expect(snapshot.pairings[0]?.ratios.scorePerFile).toBe(1.2);
  });
});

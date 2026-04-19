import { describe, expect, test } from "bun:test";
import { renderBenchmarkReport } from "./report";
import type { BenchmarkSet, BenchmarkSnapshot } from "./types";

const set: BenchmarkSet = {
  schemaVersion: 1,
  id: "sample",
  name: "Sample",
  description: "sample benchmark",
  artifacts: { snapshotPath: "./snapshot.json", reportPath: "./report.md" },
  repos: [],
  pairings: [{ aiRepoId: "ai", solidRepoId: "oss" }],
};

const snapshot: BenchmarkSnapshot = {
  schemaVersion: 1,
  benchmarkSetId: "sample",
  benchmarkSetName: "Sample",
  generatedAt: "2026-04-19T00:00:00.000Z",
  analyzerVersion: "1.0.1",
  repos: [
    {
      id: "ai",
      path: "./ai",
      cohort: "explicit-ai",
      pack: "js-ts",
      score: 80,
      summary: { critical: 0, high: 1, medium: 0, low: 0 },
      metrics: { fileCount: 2, lineCount: 20, nonEmptyLineCount: 10, normalized: { scorePerFile: 40, scorePerKloc: 8000, findingsPerFile: 1, findingsPerKloc: 200 } },
      blendedScore: 2,
      ruleCounts: { CONSOLE_LOG: 2 },
      topPaths: [{ path: "./ai/src/a.ts", findingCount: 2, penalty: 6 }],
    },
    {
      id: "oss",
      path: "./oss",
      cohort: "mature-oss",
      pack: "js-ts",
      score: 95,
      summary: { critical: 0, high: 0, medium: 1, low: 0 },
      metrics: { fileCount: 2, lineCount: 20, nonEmptyLineCount: 10, normalized: { scorePerFile: 47.5, scorePerKloc: 9500, findingsPerFile: 0.5, findingsPerKloc: 100 } },
      blendedScore: 1,
      ruleCounts: { IMPORT_HEAVY: 1 },
      topPaths: [{ path: "./oss/src/a.ts", findingCount: 1, penalty: 1 }],
    },
  ],
  cohorts: {
    "explicit-ai": { repoCount: 1, medians: { scorePerFile: 40, scorePerKloc: 8000, findingsPerFile: 1, findingsPerKloc: 200 }, blendedScoreMedian: 2 },
    "mature-oss": { repoCount: 1, medians: { scorePerFile: 47.5, scorePerKloc: 9500, findingsPerFile: 0.5, findingsPerKloc: 100 }, blendedScoreMedian: 1 },
  },
  pairings: [{ aiRepoId: "ai", solidRepoId: "oss", ratios: { scorePerFile: 40 / 47.5, scorePerKloc: 8000 / 9500, findingsPerFile: 2, findingsPerKloc: 2 } }],
};

describe("benchmark report", () => {
  test("renders cohort tables and pairing ratios", () => {
    const report = renderBenchmarkReport(set, snapshot);
    expect(report).toContain("# Benchmark snapshot: Sample");
    expect(report).toContain("## Explicit AI cohort");
    expect(report).toContain("## Cohort medians");
    expect(report).toContain("| ai | oss |");
  });
});

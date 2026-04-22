import { describe, expect, test } from "bun:test";
import { createBenchmarkSnapshot } from "./snapshot";
import type { BenchmarkRepoSnapshot, BenchmarkSet } from "./types";

const set: BenchmarkSet = {
  schemaVersion: 1,
  id: "sample",
  name: "Sample",
  description: "sample benchmark",
  artifacts: { snapshotPath: "./snapshot.json", reportPath: "./report.md" },
  repos: [
    { id: "ai", path: "./ai", cohort: "explicit-ai", pack: "js-ts" },
    { id: "oss", path: "./oss", cohort: "mature-oss", pack: "js-ts" },
  ],
  pairings: [{ aiRepoId: "ai", solidRepoId: "oss" }],
};

const repos: BenchmarkRepoSnapshot[] = [
  {
    id: "ai",
    path: "./ai",
    cohort: "explicit-ai",
    pack: "js-ts",
    score: 80,
    summary: { critical: 0, high: 1, medium: 0, low: 0 },
    metrics: {
      fileCount: 2,
      lineCount: 20,
      nonEmptyLineCount: 10,
      normalized: { scorePerFile: 40, scorePerKloc: 8000, findingsPerFile: 1, findingsPerKloc: 200 },
    },
    blendedScore: null,
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
    metrics: {
      fileCount: 2,
      lineCount: 20,
      nonEmptyLineCount: 10,
      normalized: { scorePerFile: 47.5, scorePerKloc: 9500, findingsPerFile: 0.5, findingsPerKloc: 100 },
    },
    blendedScore: null,
    ruleCounts: { IMPORT_HEAVY: 1 },
    topPaths: [{ path: "./oss/src/a.ts", findingCount: 1, penalty: 1 }],
  },
];

describe("benchmark snapshot", () => {
  test("builds cohort medians, blended scores, and pair ratios", () => {
    const snapshot = createBenchmarkSnapshot(set, repos, "1.0.2", "2026-04-19T00:00:00.000Z");

    expect(snapshot.cohorts["mature-oss"].medians.scorePerFile).toBe(47.5);
    expect(snapshot.repos.find((repo) => repo.id === "oss")?.blendedScore).toBe(1);
    expect(snapshot.pairings[0]?.ratios.findingsPerKloc).toBe(2);
  });
});

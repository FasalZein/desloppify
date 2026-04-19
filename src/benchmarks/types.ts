import type { PackName, PathHotspot, ScanMetricSummary, ScanReport } from "../types";

export type BenchmarkCohort = "explicit-ai" | "mature-oss";

export interface BenchmarkArtifacts {
  checkoutsDir?: string;
  snapshotPath: string;
  reportPath: string;
}

export interface BenchmarkRepoSpec {
  id: string;
  path?: string;
  repo?: string;
  url?: string;
  ref?: string;
  cohort: BenchmarkCohort;
  pack?: PackName;
  createdAt?: string;
  stars?: number;
  provenance?: string;
  notes?: string;
}

export interface BenchmarkPairing {
  aiRepoId: string;
  solidRepoId: string;
  notes?: string;
}

export interface BenchmarkSet {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  artifacts: BenchmarkArtifacts;
  repos: BenchmarkRepoSpec[];
  pairings?: BenchmarkPairing[];
}

export interface BenchmarkRepoSnapshot {
  id: string;
  path: string;
  repo?: string;
  ref?: string;
  cohort: BenchmarkCohort;
  pack: PackName;
  score: number;
  summary: ScanReport["summary"];
  metrics: ScanMetricSummary;
  blendedScore: number | null;
  ruleCounts: Record<string, number>;
  topPaths: PathHotspot[];
}

export interface BenchmarkCohortSnapshot {
  repoCount: number;
  medians: ScanMetricSummary["normalized"];
  blendedScoreMedian: number | null;
}

export interface BenchmarkPairSnapshot {
  aiRepoId: string;
  solidRepoId: string;
  notes?: string;
  ratios: ScanMetricSummary["normalized"];
}

export interface BenchmarkSnapshot {
  schemaVersion: 1;
  benchmarkSetId: string;
  benchmarkSetName: string;
  generatedAt: string;
  analyzerVersion: string;
  repos: BenchmarkRepoSnapshot[];
  cohorts: Record<BenchmarkCohort, BenchmarkCohortSnapshot>;
  pairings: BenchmarkPairSnapshot[];
}

export const BENCHMARK_METRIC_KEYS: Array<keyof ScanMetricSummary["normalized"]> = [
  "scorePerFile",
  "scorePerKloc",
  "findingsPerFile",
  "findingsPerKloc",
];

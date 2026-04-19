import type { ScanReport } from "../types";
import type {
  BenchmarkCohort,
  BenchmarkCohortSnapshot,
  BenchmarkPairSnapshot,
  BenchmarkRepoSnapshot,
  BenchmarkSet,
  BenchmarkSnapshot,
} from "./types";
import { BENCHMARK_METRIC_KEYS } from "./types";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  const left = sorted[middle - 1];
  const right = sorted[middle];
  return left !== undefined && right !== undefined ? (left + right) / 2 : null;
}

function geometricMean(values: number[]): number | null {
  if (values.length === 0) return null;
  if (values.some((value) => value <= 0)) return null;
  return Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length);
}

function divideOrNull(numerator: number | null, denominator: number | null): number | null {
  return numerator !== null && denominator !== null && denominator !== 0 ? numerator / denominator : null;
}

function summarizeRuleCounts(report: ScanReport): Record<string, number> {
  const counts = new Map<string, number>();
  for (const finding of report.findings) {
    counts.set(finding.rule_id, (counts.get(finding.rule_id) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

export function createRepoSnapshot(spec: BenchmarkSet["repos"][number], report: ScanReport): BenchmarkRepoSnapshot {
  return {
    id: spec.id,
    path: spec.path,
    cohort: spec.cohort,
    pack: spec.pack ?? report.scan.pack.name,
    score: report.score,
    summary: report.summary,
    metrics: report.metrics,
    blendedScore: null,
    ruleCounts: summarizeRuleCounts(report),
    topPaths: report.hotspots.paths.slice(0, 5),
  };
}

function buildMedianMetrics(repos: BenchmarkRepoSnapshot[]): BenchmarkRepoSnapshot["metrics"]["normalized"] {
  return Object.fromEntries(BENCHMARK_METRIC_KEYS.map((metricKey) => {
    const values = repos.map((repo) => repo.metrics.normalized[metricKey]).filter((value): value is number => value !== null);
    return [metricKey, median(values)];
  })) as BenchmarkRepoSnapshot["metrics"]["normalized"];
}

function computeRawBlendedScore(metrics: BenchmarkRepoSnapshot["metrics"]["normalized"], baseline: BenchmarkRepoSnapshot["metrics"]["normalized"]): number | null {
  const ratios = BENCHMARK_METRIC_KEYS.flatMap((metricKey) => {
    const value = metrics[metricKey];
    const denominator = baseline[metricKey];
    return value !== null && denominator !== null && denominator > 0 ? [value / denominator] : [];
  });
  return geometricMean(ratios);
}

function buildCohortSnapshots(repos: BenchmarkRepoSnapshot[]): Record<BenchmarkCohort, BenchmarkCohortSnapshot> {
  const grouped: Record<BenchmarkCohort, BenchmarkRepoSnapshot[]> = { "explicit-ai": [], "mature-oss": [] };
  for (const repo of repos) grouped[repo.cohort].push(repo);

  const build = (items: BenchmarkRepoSnapshot[]): BenchmarkCohortSnapshot => ({
    repoCount: items.length,
    medians: buildMedianMetrics(items),
    blendedScoreMedian: median(items.map((item) => item.blendedScore).filter((value): value is number => value !== null)),
  });

  return {
    "explicit-ai": build(grouped["explicit-ai"]),
    "mature-oss": build(grouped["mature-oss"]),
  };
}

function applyBlendedScores(repos: BenchmarkRepoSnapshot[]): BenchmarkRepoSnapshot[] {
  const matureMedian = buildMedianMetrics(repos.filter((repo) => repo.cohort === "mature-oss"));
  const raw = repos.map((repo) => ({ repo, rawScore: computeRawBlendedScore(repo.metrics.normalized, matureMedian) }));
  const matureBaseline = median(raw.filter(({ repo }) => repo.cohort === "mature-oss").map(({ rawScore }) => rawScore).filter((value): value is number => value !== null));

  return raw.map(({ repo, rawScore }) => ({
    ...repo,
    blendedScore: rawScore !== null && matureBaseline !== null && matureBaseline > 0 ? rawScore / matureBaseline : rawScore,
  }));
}

function buildPairings(set: BenchmarkSet, repos: BenchmarkRepoSnapshot[]): BenchmarkPairSnapshot[] {
  return (set.pairings ?? []).map((pairing) => {
    const aiRepo = repos.find((repo) => repo.id === pairing.aiRepoId);
    const solidRepo = repos.find((repo) => repo.id === pairing.solidRepoId);
    if (!aiRepo || !solidRepo) {
      throw new Error(`Unable to resolve pairing ${pairing.aiRepoId} -> ${pairing.solidRepoId}`);
    }

    const ratios = Object.fromEntries(BENCHMARK_METRIC_KEYS.map((metricKey) => [
      metricKey,
      divideOrNull(aiRepo.metrics.normalized[metricKey], solidRepo.metrics.normalized[metricKey]),
    ])) as BenchmarkRepoSnapshot["metrics"]["normalized"];

    return {
      aiRepoId: pairing.aiRepoId,
      solidRepoId: pairing.solidRepoId,
      notes: pairing.notes,
      ratios,
    };
  });
}

export function createBenchmarkSnapshot(set: BenchmarkSet, repos: BenchmarkRepoSnapshot[], analyzerVersion: string, generatedAt = new Date().toISOString()): BenchmarkSnapshot {
  const reposWithScores = applyBlendedScores(repos);
  return {
    schemaVersion: 1,
    benchmarkSetId: set.id,
    benchmarkSetName: set.name,
    generatedAt,
    analyzerVersion,
    repos: reposWithScores,
    cohorts: buildCohortSnapshots(reposWithScores),
    pairings: buildPairings(set, reposWithScores),
  };
}

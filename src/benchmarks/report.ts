import type { BenchmarkRepoSnapshot, BenchmarkSet, BenchmarkSnapshot } from "./types";
import { BENCHMARK_METRIC_KEYS } from "./types";

function formatMetric(value: number | null): string {
  return value === null ? "n/a" : value.toFixed(2);
}

function formatRatio(value: number | null): string {
  return value === null ? "n/a" : `${value.toFixed(2)}x`;
}

function sortRepos(repos: BenchmarkRepoSnapshot[]): BenchmarkRepoSnapshot[] {
  return [...repos].sort((a, b) => (b.blendedScore ?? Number.NEGATIVE_INFINITY) - (a.blendedScore ?? Number.NEGATIVE_INFINITY) || a.id.localeCompare(b.id));
}

function renderRepoTable(repos: BenchmarkRepoSnapshot[]): string[] {
  return [
    "| Repo | Source | Ref | Blended | Score | Files | Score/file | Score/KLOC | Findings/file | Findings/KLOC |",
    "|---|---|---|---:|---:|---:|---:|---:|---:|---:|",
    ...sortRepos(repos).map((repo) => `| ${repo.id} | ${repo.repo ?? repo.path} | ${repo.ref ?? "local"} | ${formatMetric(repo.blendedScore)} | ${repo.score} | ${repo.metrics.fileCount} | ${formatMetric(repo.metrics.normalized.scorePerFile)} | ${formatMetric(repo.metrics.normalized.scorePerKloc)} | ${formatMetric(repo.metrics.normalized.findingsPerFile)} | ${formatMetric(repo.metrics.normalized.findingsPerKloc)} |`),
  ];
}

export function renderBenchmarkReport(set: BenchmarkSet, snapshot: BenchmarkSnapshot): string {
  const aiRepos = snapshot.repos.filter((repo) => repo.cohort === "explicit-ai");
  const solidRepos = snapshot.repos.filter((repo) => repo.cohort === "mature-oss");
  const aiMedian = snapshot.cohorts["explicit-ai"].medians;
  const solidMedian = snapshot.cohorts["mature-oss"].medians;

  return [
    `# Benchmark snapshot: ${set.name}`,
    "",
    set.description,
    "",
    `Generated: ${snapshot.generatedAt}`,
    `Analyzer version: ${snapshot.analyzerVersion}`,
    "",
    "## Reproduction",
    "",
    "```bash",
    `desloppify benchmark snapshot --manifest <manifest>`,
    `desloppify benchmark report --manifest <manifest>`,
    "```",
    "",
    "## Explicit AI cohort",
    "",
    ...renderRepoTable(aiRepos),
    "",
    "## Mature OSS cohort",
    "",
    ...renderRepoTable(solidRepos),
    "",
    "## Cohort medians",
    "",
    "| Metric | AI median | Solid median | Ratio |",
    "|---|---:|---:|---:|",
    ...BENCHMARK_METRIC_KEYS.map((metricKey) => `| ${metricKey} | ${formatMetric(aiMedian[metricKey])} | ${formatMetric(solidMedian[metricKey])} | ${formatRatio(aiMedian[metricKey] !== null && solidMedian[metricKey] !== null && solidMedian[metricKey] !== 0 ? aiMedian[metricKey] / solidMedian[metricKey] : null)} |`),
    "",
    "## Pairings",
    "",
    "| AI repo | Solid repo | Score/file | Score/KLOC | Findings/file | Findings/KLOC |",
    "|---|---|---:|---:|---:|---:|",
    ...(snapshot.pairings.length > 0
      ? snapshot.pairings.map((pairing) => `| ${pairing.aiRepoId} | ${pairing.solidRepoId} | ${formatRatio(pairing.ratios.scorePerFile)} | ${formatRatio(pairing.ratios.scorePerKloc)} | ${formatRatio(pairing.ratios.findingsPerFile)} | ${formatRatio(pairing.ratios.findingsPerKloc)} |`)
      : ["| n/a | n/a | n/a | n/a | n/a | n/a |"]),
  ].join("\n");
}

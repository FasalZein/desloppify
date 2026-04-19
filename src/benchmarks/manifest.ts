import { dirname, join, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import type { BenchmarkRepoSpec, BenchmarkSet } from "./types";

export const DEFAULT_BENCHMARK_SET_PATH = resolve(process.cwd(), "benchmarks/sets/default.json");

export function loadBenchmarkSet(manifestPath = DEFAULT_BENCHMARK_SET_PATH): BenchmarkSet {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as BenchmarkSet;
}

export function resolveBenchmarkPath(manifestPath: string, targetPath: string): string {
  return resolve(dirname(manifestPath), targetPath);
}

export function getBenchmarkCheckoutPath(manifestPath: string, set: BenchmarkSet, repo: BenchmarkRepoSpec): string {
  if (!set.artifacts.checkoutsDir) {
    throw new Error(`Benchmark manifest must define artifacts.checkoutsDir to use fetched repos: ${repo.id}`);
  }
  return join(resolveBenchmarkPath(manifestPath, set.artifacts.checkoutsDir), repo.id);
}

export function resolveBenchmarkRepoPath(manifestPath: string, set: BenchmarkSet, repo: BenchmarkRepoSpec): string {
  if (repo.path) return resolveBenchmarkPath(manifestPath, repo.path);
  return getBenchmarkCheckoutPath(manifestPath, set, repo);
}

export function isFetchedBenchmarkRepo(repo: BenchmarkRepoSpec): boolean {
  return !repo.path && Boolean(repo.url && repo.ref);
}

export function validateBenchmarkRepo(repo: BenchmarkRepoSpec): void {
  if (repo.path) return;
  if (!repo.url || !repo.ref) {
    throw new Error(`Benchmark repo ${repo.id} must define either path or both url and ref`);
  }
}

export function hasBenchmarkCheckout(manifestPath: string, set: BenchmarkSet, repo: BenchmarkRepoSpec): boolean {
  return existsSync(join(getBenchmarkCheckoutPath(manifestPath, set, repo), ".git"));
}

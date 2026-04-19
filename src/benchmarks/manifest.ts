import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { BenchmarkSet } from "./types";

export const DEFAULT_BENCHMARK_SET_PATH = resolve(process.cwd(), "benchmarks/sets/default.json");

export function loadBenchmarkSet(manifestPath = DEFAULT_BENCHMARK_SET_PATH): BenchmarkSet {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as BenchmarkSet;
}

export function resolveBenchmarkPath(manifestPath: string, targetPath: string): string {
  return resolve(dirname(manifestPath), targetPath);
}

import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getBenchmarkCheckoutPath, isFetchedBenchmarkRepo, loadBenchmarkSet, resolveBenchmarkPath, resolveBenchmarkRepoPath, validateBenchmarkRepo } from "./manifest";

let tempRoot: string | undefined;

afterEach(() => {
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = undefined;
});

describe("benchmark manifest", () => {
  test("loads a benchmark manifest and resolves relative artifact paths", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-benchmark-manifest-"));
    const manifestPath = join(tempRoot, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({
      schemaVersion: 1,
      id: "sample",
      name: "Sample",
      description: "sample",
      artifacts: { snapshotPath: "./artifacts/snapshot.json", reportPath: "./artifacts/report.md" },
      repos: [{ id: "ai", path: "./ai", cohort: "explicit-ai", pack: "js-ts" }],
      pairings: [],
    }, null, 2));

    const loaded = loadBenchmarkSet(manifestPath);
    expect(loaded.id).toBe("sample");
    expect(resolveBenchmarkPath(manifestPath, loaded.artifacts.snapshotPath)).toBe(join(tempRoot, "artifacts", "snapshot.json"));
  });

  test("resolves fetched benchmark repo paths through checkoutsDir", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-benchmark-checkouts-"));
    mkdirSync(join(tempRoot, "benchmarks"), { recursive: true });
    const manifestPath = join(tempRoot, "benchmarks", "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({
      schemaVersion: 1,
      id: "sample",
      name: "Sample",
      description: "sample",
      artifacts: { checkoutsDir: "./checkouts", snapshotPath: "./snapshot.json", reportPath: "./report.md" },
      repos: [{ id: "ai", url: "https://example.com/repo.git", ref: "abc123", cohort: "explicit-ai", pack: "js-ts" }],
      pairings: [],
    }, null, 2));

    const loaded = loadBenchmarkSet(manifestPath);
    const repo = loaded.repos[0]!;
    validateBenchmarkRepo(repo);
    expect(isFetchedBenchmarkRepo(repo)).toBe(true);
    expect(getBenchmarkCheckoutPath(manifestPath, loaded, repo)).toBe(join(tempRoot, "benchmarks", "checkouts", "ai"));
    expect(resolveBenchmarkRepoPath(manifestPath, loaded, repo)).toBe(join(tempRoot, "benchmarks", "checkouts", "ai"));
  });
});

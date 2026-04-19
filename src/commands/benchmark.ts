import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineCommand } from "citty";
import packageJson from "../../package.json";
import { DEFAULT_BENCHMARK_SET_PATH, getBenchmarkCheckoutPath, hasBenchmarkCheckout, isFetchedBenchmarkRepo, loadBenchmarkSet, resolveBenchmarkPath, resolveBenchmarkRepoPath, validateBenchmarkRepo } from "../benchmarks/manifest";
import { renderBenchmarkReport } from "../benchmarks/report";
import { createBenchmarkSnapshot, createRepoSnapshot } from "../benchmarks/snapshot";
import type { BenchmarkRepoSpec, BenchmarkSet, BenchmarkSnapshot } from "../benchmarks/types";
import type { ScanReport } from "../types";

const cliPath = fileURLToPath(new URL("../cli.ts", import.meta.url));

export default defineCommand({
  meta: { name: "benchmark", description: "Benchmark harness for pinned repo cohorts" },
  subCommands: {
    fetch: defineCommand({
      meta: { name: "fetch", description: "Clone/fetch pinned benchmark checkouts from a manifest" },
      args: {
        manifest: { type: "string", description: "Benchmark manifest path", default: DEFAULT_BENCHMARK_SET_PATH },
      },
      run({ args }) {
        const manifestPath = resolve(args.manifest);
        const set = loadBenchmarkSet(manifestPath);
        for (const repo of set.repos) {
          validateBenchmarkRepo(repo);
          if (!isFetchedBenchmarkRepo(repo)) continue;
          fetchRepo(manifestPath, set, repo);
        }
      },
    }),
    snapshot: defineCommand({
      meta: { name: "snapshot", description: "Build a benchmark snapshot from a manifest" },
      args: {
        manifest: { type: "string", description: "Benchmark manifest path", default: DEFAULT_BENCHMARK_SET_PATH },
      },
      run({ args }) {
        const manifestPath = resolve(args.manifest);
        const set = loadBenchmarkSet(manifestPath);
        const repos = set.repos.map((repo) => {
          validateBenchmarkRepo(repo);
          if (isFetchedBenchmarkRepo(repo) && !hasBenchmarkCheckout(manifestPath, set, repo)) {
            throw new Error(`Missing checkout for ${repo.id}. Run: desloppify benchmark fetch --manifest ${manifestPath}`);
          }
          return scanRepo(manifestPath, set, repo);
        });
        const snapshot = createBenchmarkSnapshot(set, repos, packageJson.version);
        const snapshotPath = resolveBenchmarkPath(manifestPath, set.artifacts.snapshotPath);
        mkdirSync(dirname(snapshotPath), { recursive: true });
        writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
        console.log(`Wrote benchmark snapshot to ${snapshotPath}`);
      },
    }),
    report: defineCommand({
      meta: { name: "report", description: "Render a benchmark markdown report from a snapshot" },
      args: {
        manifest: { type: "string", description: "Benchmark manifest path", default: DEFAULT_BENCHMARK_SET_PATH },
      },
      run({ args }) {
        const manifestPath = resolve(args.manifest);
        const set = loadBenchmarkSet(manifestPath);
        const snapshotPath = resolveBenchmarkPath(manifestPath, set.artifacts.snapshotPath);
        const reportPath = resolveBenchmarkPath(manifestPath, set.artifacts.reportPath);
        const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as BenchmarkSnapshot;
        const report = renderBenchmarkReport(set, snapshot);
        mkdirSync(dirname(reportPath), { recursive: true });
        writeFileSync(reportPath, `${report}\n`, "utf8");
        console.log(`Wrote benchmark report to ${reportPath}`);
      },
    }),
  },
});

function scanRepo(manifestPath: string, set: BenchmarkSet, repo: BenchmarkRepoSpec) {
  const repoPath = resolveBenchmarkRepoPath(manifestPath, set, repo);
  if (repo.ref) {
    const actualRef = runGit(["rev-parse", "HEAD"], repoPath).trim();
    if (actualRef !== repo.ref) {
      throw new Error(`Pinned ref mismatch for ${repo.id}: expected ${repo.ref}, got ${actualRef}`);
    }
  }

  const result = Bun.spawnSync(["bun", cliPath, "scan", repoPath, "--pack", repo.pack ?? "js-ts", "--json"], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  if (![0, 1].includes(result.exitCode)) {
    throw new Error(`Benchmark scan failed for ${repo.id}: ${result.stderr.toString() || result.stdout.toString()}`);
  }

  const report = JSON.parse(result.stdout.toString()) as ScanReport;
  return createRepoSnapshot({ ...repo, path: repoPath }, report);
}

function fetchRepo(manifestPath: string, set: BenchmarkSet, repo: BenchmarkRepoSpec): void {
  const checkoutPath = getBenchmarkCheckoutPath(manifestPath, set, repo);
  mkdirSync(dirname(checkoutPath), { recursive: true });

  if (!existsSync(checkoutPath) || !existsSync(`${checkoutPath}/.git`)) {
    runGit(["clone", "--filter=blob:none", "--no-checkout", repo.url!, checkoutPath]);
  }

  runGit(["remote", "set-url", "origin", repo.url!], checkoutPath);
  runGit(["fetch", "--force", "--prune", "--filter=blob:none", "origin"], checkoutPath);
  runGit(["checkout", "--force", "--detach", repo.ref!], checkoutPath);
  runGit(["reset", "--hard", repo.ref!], checkoutPath);
  runGit(["clean", "-fdx"], checkoutPath);

  const actualRef = runGit(["rev-parse", "HEAD"], checkoutPath).trim();
  if (actualRef !== repo.ref) {
    throw new Error(`Pinned ref mismatch for ${repo.id}: expected ${repo.ref}, got ${actualRef}`);
  }

  console.log(`ready ${repo.id} at ${actualRef.slice(0, 7)} -> ${checkoutPath}`);
}

function runGit(args: string[], cwd?: string): string {
  const result = Bun.spawnSync(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString() || result.stdout.toString()}`);
  }

  return result.stdout.toString();
}

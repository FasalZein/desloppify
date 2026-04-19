import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineCommand } from "citty";
import packageJson from "../../package.json";
import { loadBenchmarkSet, resolveBenchmarkPath, DEFAULT_BENCHMARK_SET_PATH } from "../benchmarks/manifest";
import { renderBenchmarkReport } from "../benchmarks/report";
import { createBenchmarkSnapshot, createRepoSnapshot } from "../benchmarks/snapshot";
import type { BenchmarkRepoSpec, BenchmarkSet, BenchmarkSnapshot } from "../benchmarks/types";
import type { ScanReport } from "../types";

const cliPath = fileURLToPath(new URL("../cli.ts", import.meta.url));

export default defineCommand({
  meta: { name: "benchmark", description: "Benchmark harness for pinned repo cohorts" },
  subCommands: {
    snapshot: defineCommand({
      meta: { name: "snapshot", description: "Build a benchmark snapshot from a manifest" },
      args: {
        manifest: { type: "string", description: "Benchmark manifest path", default: DEFAULT_BENCHMARK_SET_PATH },
      },
      run({ args }) {
        const manifestPath = resolve(args.manifest);
        const set = loadBenchmarkSet(manifestPath);
        const repos = set.repos.map((repo) => scanRepo({ ...repo, path: resolveBenchmarkPath(manifestPath, repo.path) }));
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

function scanRepo(repo: BenchmarkRepoSpec) {
  const result = Bun.spawnSync(["bun", cliPath, "scan", repo.path, "--pack", repo.pack ?? "js-ts", "--json"], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  if (![0, 1].includes(result.exitCode)) {
    throw new Error(`Benchmark scan failed for ${repo.id}: ${result.stderr.toString() || result.stdout.toString()}`);
  }

  const report = JSON.parse(result.stdout.toString()) as ScanReport;
  return createRepoSnapshot(repo, report);
}

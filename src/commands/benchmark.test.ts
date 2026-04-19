import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempRoots: string[] = [];
const cliPath = join(process.cwd(), "src/cli.ts");

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function run(args: string[]) {
  return Bun.spawnSync(["bun", cliPath, ...args], { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" });
}

describe("benchmark command", () => {
  test("builds snapshot and report from a local manifest", () => {
    const root = mkdtempSync(join(tmpdir(), "desloppify-benchmark-"));
    tempRoots.push(root);

    const aiRepo = join(root, "ai-repo");
    const ossRepo = join(root, "oss-repo");
    mkdirSync(join(aiRepo, "src"), { recursive: true });
    mkdirSync(join(ossRepo, "src"), { recursive: true });
    writeFileSync(join(aiRepo, "src", "example.ts"), 'console.log("hi")\n', "utf8");
    writeFileSync(join(ossRepo, "src", "example.ts"), 'export const value = 1\n', "utf8");

    const manifestPath = join(root, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({
      schemaVersion: 1,
      id: "sample",
      name: "Sample benchmark",
      description: "sample benchmark",
      artifacts: { snapshotPath: "./artifacts/snapshot.json", reportPath: "./artifacts/report.md" },
      repos: [
        { id: "ai", path: "./ai-repo", cohort: "explicit-ai", pack: "js-ts" },
        { id: "oss", path: "./oss-repo", cohort: "mature-oss", pack: "js-ts" },
      ],
      pairings: [{ aiRepoId: "ai", solidRepoId: "oss" }],
    }, null, 2));

    const snapshot = run(["benchmark", "snapshot", "--manifest", manifestPath]);
    expect(snapshot.exitCode).toBe(0);
    expect(existsSync(join(root, "artifacts", "snapshot.json"))).toBe(true);

    const report = run(["benchmark", "report", "--manifest", manifestPath]);
    expect(report.exitCode).toBe(0);
    expect(existsSync(join(root, "artifacts", "report.md"))).toBe(true);

    const snapshotJson = JSON.parse(readFileSync(join(root, "artifacts", "snapshot.json"), "utf8"));
    const reportText = readFileSync(join(root, "artifacts", "report.md"), "utf8");
    expect(snapshotJson.repos).toHaveLength(2);
    expect(snapshotJson.pairings[0].aiRepoId).toBe("ai");
    expect(reportText).toContain("## Explicit AI cohort");
    expect(reportText).toContain("## Pairings");
  });
});

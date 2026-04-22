import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

setDefaultTimeout(15000);

const tempRoots: string[] = [];
const cliPath = join(process.cwd(), "src/cli.ts");

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function run(args: string[]) {
  return Bun.spawnSync(["bun", cliPath, ...args], { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" });
}

function initGitRepo(root: string) {
  Bun.spawnSync(["git", "init", "-q", root], { stdout: "pipe", stderr: "pipe" });
  Bun.spawnSync(["git", "-C", root, "config", "user.email", "test@example.com"], { stdout: "pipe", stderr: "pipe" });
  Bun.spawnSync(["git", "-C", root, "config", "user.name", "Desloppify Test"], { stdout: "pipe", stderr: "pipe" });
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
    expect(reportText).toContain(`| ai | ${join(root, "ai-repo")} | local |`);
    expect(reportText).toContain("## Pairings");
  });

  test("fetches pinned checkouts and snapshots them", () => {
    const root = mkdtempSync(join(tmpdir(), "desloppify-benchmark-fetch-"));
    tempRoots.push(root);

    const aiSource = join(root, "ai-source");
    const ossSource = join(root, "oss-source");
    mkdirSync(join(aiSource, "src"), { recursive: true });
    mkdirSync(join(ossSource, "src"), { recursive: true });
    initGitRepo(aiSource);
    initGitRepo(ossSource);
    writeFileSync(join(aiSource, "src", "example.ts"), 'console.log("hi")\n', "utf8");
    writeFileSync(join(ossSource, "src", "example.ts"), 'export const value = 1\n', "utf8");
    Bun.spawnSync(["git", "-C", aiSource, "add", "."], { stdout: "pipe", stderr: "pipe" });
    Bun.spawnSync(["git", "-C", aiSource, "commit", "-qm", "init"], { stdout: "pipe", stderr: "pipe" });
    Bun.spawnSync(["git", "-C", ossSource, "add", "."], { stdout: "pipe", stderr: "pipe" });
    Bun.spawnSync(["git", "-C", ossSource, "commit", "-qm", "init"], { stdout: "pipe", stderr: "pipe" });
    const aiRef = Bun.spawnSync(["git", "-C", aiSource, "rev-parse", "HEAD"], { stdout: "pipe", stderr: "pipe" }).stdout.toString().trim();
    const ossRef = Bun.spawnSync(["git", "-C", ossSource, "rev-parse", "HEAD"], { stdout: "pipe", stderr: "pipe" }).stdout.toString().trim();

    const manifestPath = join(root, "manifest-fetch.json");
    writeFileSync(manifestPath, JSON.stringify({
      schemaVersion: 1,
      id: "sample-fetch",
      name: "Sample fetch benchmark",
      description: "sample fetch benchmark",
      artifacts: { checkoutsDir: "./checkouts", snapshotPath: "./artifacts/snapshot.json", reportPath: "./artifacts/report.md" },
      repos: [
        { id: "ai", url: aiSource, ref: aiRef, repo: "local/ai", cohort: "explicit-ai", pack: "js-ts" },
        { id: "oss", url: ossSource, ref: ossRef, repo: "local/oss", cohort: "mature-oss", pack: "js-ts" },
      ],
      pairings: [{ aiRepoId: "ai", solidRepoId: "oss" }],
    }, null, 2));

    const fetch = run(["benchmark", "fetch", "--manifest", manifestPath]);
    expect(fetch.exitCode).toBe(0);
    expect(existsSync(join(root, "checkouts", "ai", ".git"))).toBe(true);
    expect(existsSync(join(root, "checkouts", "oss", ".git"))).toBe(true);

    const snapshot = run(["benchmark", "snapshot", "--manifest", manifestPath]);
    expect(snapshot.exitCode).toBe(0);
    const report = run(["benchmark", "report", "--manifest", manifestPath]);
    expect(report.exitCode).toBe(0);

    const snapshotJson = JSON.parse(readFileSync(join(root, "artifacts", "snapshot.json"), "utf8"));
    const reportText = readFileSync(join(root, "artifacts", "report.md"), "utf8");
    expect(snapshotJson.repos[0].ref).toBe(aiRef);
    expect(snapshotJson.repos[1].ref).toBe(ossRef);
    expect(reportText).toContain(`| ai | local/ai | ${aiRef} |`);
    expect(reportText).toContain(`| oss | local/oss | ${ossRef} |`);
  });
});

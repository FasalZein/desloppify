import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanProject, scanProjectSummary } from "./public-api";

setDefaultTimeout(15000);

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function createTempRepo() {
  const root = mkdtempSync(join(tmpdir(), "desloppify-public-api-"));
  tempRoots.push(root);
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0" }));
  writeFileSync(join(root, "index.ts"), 'console.log("debug");\n');
  return root;
}

describe("public API", () => {
  test("package exports a stable root entry without leaking src internals", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { exports?: Record<string, unknown> };
    const exportKeys = pkg.exports ? Object.keys(pkg.exports) : [];
    expect(exportKeys).toContain(".");
    expect(exportKeys).not.toContain("./src/*");
  });

  test("scanProject returns the canonical full report", async () => {
    const root = createTempRepo();
    const report = await scanProject({ path: root, pack: "js-ts" });

    expect(report.scan.path).toBe(root);
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.summary.medium + report.summary.low + report.summary.high + report.summary.critical).toBeGreaterThan(0);
  });

  test("scanProjectSummary omits the full findings payload", async () => {
    const root = createTempRepo();
    const summary = await scanProjectSummary({ path: root, pack: "js-ts" });

    expect(summary.findingCount).toBeGreaterThan(0);
    expect(summary).not.toHaveProperty("findings");
    expect(summary).not.toHaveProperty("rules");
  });
});

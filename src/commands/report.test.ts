import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempRoots: string[] = [];
const cliPath = join(process.cwd(), "src/cli.ts");

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function createTempRepo() {
  const root = mkdtempSync(join(tmpdir(), "desloppify-report-"));
  tempRoots.push(root);
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src", "example.ts"), 'console.log("hi")\n', "utf8");
  return root;
}

function run(args: string[], cwd = process.cwd()) {
  return Bun.spawnSync(["bun", cliPath, ...args], { cwd, stdout: "pipe", stderr: "pipe" });
}

describe("report command", () => {
  test("declares saved-report args", () => {
    const source = readFileSync(join(process.cwd(), "src", "commands", "report.ts"), "utf8");
    expect(source).toContain('name: "report"');
    expect(source).toContain('report: { type: "string"');
    expect(source).toContain('json: { type: "boolean"');
  });

  test("renders normalized metrics from a saved scan report", () => {
    const root = createTempRepo();
    const scan = run(["scan", root, "--pack", "js-ts", "--json"]);
    expect(scan.exitCode).toBe(1);
    expect(existsSync(join(root, ".desloppify", "reports", "latest.findings.json"))).toBe(true);

    const result = run(["report", root]);
    const output = result.stdout.toString();

    expect(result.exitCode).toBe(0);
    expect(output).toContain("desloppify report");
    expect(output).toContain("Normalized metrics:");
    expect(output).toContain("Path hotspots:");
    expect(output).toContain("src/example.ts");
  });
});

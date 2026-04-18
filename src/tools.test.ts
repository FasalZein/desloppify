import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { detectAvailablePacks, detectProject, detectSuggestedPack, printToolStatus } from "./tools";

describe("tools", () => {
  test("detectProject sees this repo as js/ts", () => {
    const project = detectProject(process.cwd());
    expect(project.javascript).toBe(true);
    expect(project.typescript).toBe(true);
  });

  test("detectSuggestedPack returns python for python-only repos", () => {
    const root = mkdtempSync(join(tmpdir(), "desloppify-python-pack-"));
    writeFileSync(join(root, "requirements.txt"), "ruff\n");

    expect(detectAvailablePacks(root)).toEqual(["python"]);
    expect(detectSuggestedPack(root)).toBe("python");
  });

  test("detectSuggestedPack returns null for mixed repos", () => {
    const root = mkdtempSync(join(tmpdir(), "desloppify-mixed-pack-"));
    writeFileSync(join(root, "package.json"), "{}");
    writeFileSync(join(root, "requirements.txt"), "ruff\n");

    expect(detectAvailablePacks(root)).toEqual(["js-ts", "python"]);
    expect(detectSuggestedPack(root)).toBeNull();
  });

  test("printToolStatus returns readable output", () => {
    const output = printToolStatus({
      knip: true,
      madge: false,
      "ast-grep": true,
      tsc: true,
      eslint: false,
      biome: true,
    });

    expect(output).toContain("knip: ✓");
    expect(output).toContain("madge: ✗");
  });
});

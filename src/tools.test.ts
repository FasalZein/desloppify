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

  test("detectSuggestedPack returns rust for rust-only repos", () => {
    const root = mkdtempSync(join(tmpdir(), "desloppify-rust-pack-"));
    writeFileSync(join(root, "Cargo.toml"), "[package]\nname = \"demo\"\nversion = \"0.1.0\"\n");

    expect(detectAvailablePacks(root)).toEqual(["rust"]);
    expect(detectSuggestedPack(root)).toBe("rust");
  });

  test("detectSuggestedPack returns go for go-only repos", () => {
    const root = mkdtempSync(join(tmpdir(), "desloppify-go-pack-"));
    writeFileSync(join(root, "go.mod"), "module example.com/demo\n\ngo 1.22\n");

    expect(detectAvailablePacks(root)).toEqual(["go"]);
    expect(detectSuggestedPack(root)).toBe("go");
  });

  test("detectSuggestedPack returns ruby for ruby-only repos", () => {
    const root = mkdtempSync(join(tmpdir(), "desloppify-ruby-pack-"));
    writeFileSync(join(root, "Gemfile"), "source 'https://rubygems.org'\n");

    expect(detectAvailablePacks(root)).toEqual(["ruby"]);
    expect(detectSuggestedPack(root)).toBe("ruby");
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

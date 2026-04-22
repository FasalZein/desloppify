import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import command from "./check-tools";

const run = (args: string[]) => Bun.spawnSync(["bun", "src/cli.ts", "check-tools", ...args], {
  cwd: process.cwd(),
  stdout: "pipe",
  stderr: "pipe",
});

describe("check-tools command", () => {
  test("declares json arg", () => {
    const source = readFileSync(join(process.cwd(), "src", "commands", "check-tools.ts"), "utf8");
    expect(source).toContain('name: "check-tools"');
    expect(command.args).toHaveProperty("json");
  });

  test("json output includes detected packs and suggestion", () => {
    const root = mkdtempSync(join(tmpdir(), "desloppify-check-tools-"));
    writeFileSync(join(root, "requirements.txt"), "ruff\n");

    const result = run([root, "--json"]);
    const output = JSON.parse(result.stdout.toString());

    expect(result.exitCode).toBe(0);
    expect(output.packs).toEqual({ available: ["python"], suggested: "python" });
  });

  test("json output detects rust as a first-class pack", () => {
    const root = mkdtempSync(join(tmpdir(), "desloppify-check-tools-rust-"));
    writeFileSync(join(root, "Cargo.toml"), "[package]\nname = \"demo\"\nversion = \"0.1.0\"\n");

    const result = run([root, "--json"]);
    const output = JSON.parse(result.stdout.toString());

    expect(result.exitCode).toBe(0);
    expect(output.packs).toEqual({ available: ["rust"], suggested: "rust" });
  });

  test("json output detects go as a first-class pack", () => {
    const root = mkdtempSync(join(tmpdir(), "desloppify-check-tools-go-"));
    writeFileSync(join(root, "go.mod"), "module example.com/demo\n\ngo 1.22\n");

    const result = run([root, "--json"]);
    const output = JSON.parse(result.stdout.toString());

    expect(result.exitCode).toBe(0);
    expect(output.packs).toEqual({ available: ["go"], suggested: "go" });
  });

  test("json output detects ruby as a first-class pack", () => {
    const root = mkdtempSync(join(tmpdir(), "desloppify-check-tools-ruby-"));
    writeFileSync(join(root, "Gemfile"), "source 'https://rubygems.org'\n");

    const result = run([root, "--json"]);
    const output = JSON.parse(result.stdout.toString());

    expect(result.exitCode).toBe(0);
    expect(output.packs).toEqual({ available: ["ruby"], suggested: "ruby" });
  });
});

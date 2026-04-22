import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tempRoot: string | undefined;
const repoRoot = process.cwd();
const cliPath = join(repoRoot, "src/cli.ts");

afterEach(() => {
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = undefined;
});

const run = (args: string[], cwd = repoRoot) => Bun.spawnSync(["bun", cliPath, "rules", ...args], {
  cwd,
  stdout: "pipe",
  stderr: "pipe",
});

describe("rules command", () => {
  test("surfaces newly implemented research-driven rules", () => {
    const result = run(["--json"]);
    const rules = JSON.parse(result.stdout.toString()) as Array<{ id: string }>;

    expect(result.exitCode).toBe(0);
    const ids = rules.map((rule) => rule.id);

    expect(ids).toEqual(expect.arrayContaining([
      "BANNER_COMMENT",
      "BOOLEAN_FLAG_PARAMS",
      "EMPTY_ARRAY_FALLBACK",
      "DEAD_FEATURE_FLAG",
      "HANDWAVY_COMMENT",
      "NOT_IMPLEMENTED_STUB",
      "THROW_NON_ERROR",
      "CATCH_WRAP_NO_CAUSE",
    ]));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("filters by architecture profile", () => {
    const result = run(["--architecture", "modular-monolith"]);
    const output = result.stdout.toString();

    expect(result.exitCode).toBe(0);
    expect(output).toContain("LAYER_BOUNDARY_VIOLATION");
    expect(output).toContain("PRIVATE_MODULE_IMPORT");
  });

  test("filters by pack", () => {
    const result = run(["--pack", "python"]);
    const output = result.stdout.toString();

    expect(result.exitCode).toBe(0);
    expect(output).toContain("Pack: python");
    expect(output).toContain("MUTABLE_DEFAULT");
    expect(output).toContain("BARE_EXCEPT");
    expect(output).not.toContain("USEEFFECT_ASYNC");
    expect(output).not.toContain("UNWRAP_CALL");
  });

  test("filters rust-owned rules via the pack catalog", () => {
    const result = run(["--pack", "rust"]);
    const output = result.stdout.toString();

    expect(result.exitCode).toBe(0);
    expect(output).toContain("Pack: rust");
    expect(output).toContain("UNWRAP_CALL");
    expect(output).toContain("EXPECT_CALL");
    expect(output).not.toContain("BARE_EXCEPT");
    expect(output).not.toContain("USEEFFECT_ASYNC");
  });

  test("applies repo config rule overrides", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-rules-config-"));
    writeFileSync(join(tempRoot, "desloppify.config.json"), JSON.stringify({
      rules: {
        CONSOLE_LOG: { enabled: false },
        LONG_FILE: { severity: "HIGH", weight: 1.5 },
      },
    }));

    const result = run(["--json"], tempRoot);
    const rules = JSON.parse(result.stdout.toString()) as Array<{ id: string; severityOverride: string | null; scoreWeight: number | null }>;

    expect(result.exitCode).toBe(0);
    expect(rules.map((rule) => rule.id)).not.toContain("CONSOLE_LOG");
    expect(rules.find((rule) => rule.id === "LONG_FILE")).toMatchObject({ severityOverride: "HIGH", scoreWeight: 1.5 });
  });

  test("loads plugin-contributed rules from config", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-rules-plugin-"));
    writeFileSync(join(tempRoot, "local-plugin.json"), JSON.stringify({
      rules: [{ id: "contains-acme", category: "ai-slop", severity: "MEDIUM", message: "Contains ACME", description: "Contains ACME marker", pattern: "ACME" }],
    }));
    writeFileSync(join(tempRoot, "desloppify.config.json"), JSON.stringify({ plugins: { local: "./local-plugin.json" } }));

    const result = run(["--json"], tempRoot);
    const rules = JSON.parse(result.stdout.toString()) as Array<{ id: string; tool: string }>;

    expect(result.exitCode).toBe(0);
    expect(rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "local/contains-acme", tool: "plugin:local" }),
    ]));
  });
});

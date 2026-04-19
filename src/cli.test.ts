import { describe, expect, test } from "bun:test";

describe("cli entrypoints", () => {
  test("prints version from source cli", () => {
    const result = Bun.spawnSync(["bun", "src/cli.ts", "version"], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString().trim()).toBe("1.0.1");
  });

  test("prints version from bin script", () => {
    const result = Bun.spawnSync(["bun", "bin/desloppify.js", "version"], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString().trim()).toBe("1.0.1");
  });

  test("loads report subcommand", () => {
    const result = Bun.spawnSync(["bun", "src/cli.ts", "report", "--help"], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("Render normalized metrics from a saved scan report");
  });

  test("loads benchmark subcommand", () => {
    const result = Bun.spawnSync(["bun", "src/cli.ts", "benchmark", "--help"], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("Benchmark harness for pinned repo cohorts");
  });
});

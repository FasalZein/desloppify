import { describe, expect, test } from "bun:test";

describe("cli entrypoints", () => {
  test("prints version from source cli", () => {
    const result = Bun.spawnSync(["bun", "src/cli.ts", "version"], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString().trim()).toBe("0.0.1");
  });

  test("prints version from bin script", () => {
    const result = Bun.spawnSync(["bun", "bin/desloppify.js", "version"], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString().trim()).toBe("0.0.1");
  });
});

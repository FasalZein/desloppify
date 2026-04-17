import { describe, expect, test } from "bun:test";

describe("bin/desloppify.js", () => {
  test("executes the CLI", () => {
    const result = Bun.spawnSync(["bun", "bin/desloppify.js", "version"], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString().trim()).toBe("1.0.0");
  });
});

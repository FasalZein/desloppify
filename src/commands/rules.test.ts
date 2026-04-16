import { describe, expect, test } from "bun:test";

const run = (args: string[]) => Bun.spawnSync(["bun", "src/cli.ts", "rules", ...args], {
  cwd: process.cwd(),
  stdout: "pipe",
  stderr: "pipe",
});

describe("rules command", () => {
  test("filters by architecture profile", () => {
    const result = run(["--architecture", "modular-monolith"]);
    const output = result.stdout.toString();

    expect(result.exitCode).toBe(0);
    expect(output).toContain("LAYER_BOUNDARY_VIOLATION");
    expect(output).toContain("PRIVATE_MODULE_IMPORT");
  });
});

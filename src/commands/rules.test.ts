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
});

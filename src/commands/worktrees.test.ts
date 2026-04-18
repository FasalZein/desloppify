import { describe, expect, test } from "bun:test";

const run = (args: string[]) => Bun.spawnSync(["bun", "src/cli.ts", "worktrees", ...args], {
  cwd: process.cwd(),
  stdout: "pipe",
  stderr: "pipe",
});

describe("worktrees command", () => {
  test("includes newer workflow categories in the default plan", () => {
    const result = run([]);
    const output = result.stdout.toString();

    expect(result.exitCode).toBe(0);
    expect(output).toContain("# async-correctness");
    expect(output).toContain("# runtime-validation");
    expect(output).toContain("# accessibility");
    expect(output).toContain("# naming-semantics");
    expect(output).toContain("git merge fix/async-correctness");
  });
});

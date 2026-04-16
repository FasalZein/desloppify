import { describe, expect, test } from "bun:test";
import { detectProject, printToolStatus } from "./tools";

describe("tools", () => {
  test("detectProject sees this repo as js/ts", () => {
    const project = detectProject(process.cwd());
    expect(project.javascript).toBe(true);
    expect(project.typescript).toBe(true);
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

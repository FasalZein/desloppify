import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import command from "./install-hooks";

describe("install-hooks command", () => {
  test("declares print arg", () => {
    const source = readFileSync(join(process.cwd(), "src", "commands", "install-hooks.ts"), "utf8");
    expect(source).toContain('name: "install-hooks"');
    expect(command.args).toHaveProperty("print");
  });
});

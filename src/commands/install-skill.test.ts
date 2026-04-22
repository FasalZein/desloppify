import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import command from "./install-skill";

describe("install-skill command", () => {
  test("declares print arg", () => {
    const source = readFileSync(join(process.cwd(), "src", "commands", "install-skill.ts"), "utf8");
    expect(source).toContain('name: "install-skill"');
    expect(command.args).toHaveProperty("print");
  });
});

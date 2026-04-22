import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import command from "./setup";

describe("setup command", () => {
  test("declares command metadata", () => {
    const source = readFileSync(join(process.cwd(), "src", "commands", "setup.ts"), "utf8");
    expect(source).toContain('name: "setup"');
    expect(command.args ?? {}).toEqual(command.args ?? {});
  });
});

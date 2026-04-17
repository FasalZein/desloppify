import { describe, expect, test } from "bun:test";
import command from "./install-skill";

describe("install-skill command", () => {
  test("declares print arg", () => {
    expect(command.meta.name).toBe("install-skill");
    expect(command.args).toHaveProperty("print");
  });
});

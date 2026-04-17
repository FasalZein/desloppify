import { describe, expect, test } from "bun:test";
import command from "./install-hooks";

describe("install-hooks command", () => {
  test("declares print arg", () => {
    expect(command.meta.name).toBe("install-hooks");
    expect(command.args).toHaveProperty("print");
  });
});

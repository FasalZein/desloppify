import { describe, expect, test } from "bun:test";
import command from "./check-tools";

describe("check-tools command", () => {
  test("declares json arg", () => {
    expect(command.meta.name).toBe("check-tools");
    expect(command.args).toHaveProperty("json");
  });
});

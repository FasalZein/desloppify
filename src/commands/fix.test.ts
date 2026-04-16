import { describe, expect, test } from "bun:test";
import command from "./fix";

describe("fix command", () => {
  test("declares safety tier args", () => {
    expect(command.meta.name).toBe("fix");
    expect(command.args).toHaveProperty("safe");
    expect(command.args).toHaveProperty("confident");
    expect(command.args).toHaveProperty("all");
  });
});

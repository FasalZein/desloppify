import { describe, expect, test } from "bun:test";
import command from "./setup";

describe("setup command", () => {
  test("declares command metadata", () => {
    expect(command.meta.name).toBe("setup");
  });
});

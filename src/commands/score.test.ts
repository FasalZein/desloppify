import { describe, expect, test } from "bun:test";
import command from "./score";

describe("score command", () => {
  test("declares explicit pack arg", () => {
    expect(command.args).toHaveProperty("pack");
  });
});

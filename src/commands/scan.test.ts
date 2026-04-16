import { describe, expect, test } from "bun:test";
import command from "./scan";

describe("scan command", () => {
  test("declares partial scan args", () => {
    expect(command.meta.name).toBe("scan");
    expect(command.args).toHaveProperty("staged");
    expect(command.args).toHaveProperty("changed");
    expect(command.args).toHaveProperty("base");
  });
});

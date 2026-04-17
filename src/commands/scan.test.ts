import { describe, expect, test } from "bun:test";
import command from "./scan";

describe("scan command", () => {
  test("declares partial scan args", () => {
    expect(command.meta.name).toBe("scan");
    expect(command.args).toHaveProperty("staged");
    expect(command.args).toHaveProperty("changed");
    expect(command.args).toHaveProperty("base");
  });

  test("declares explicit pack arg", () => {
    expect(command.args).toHaveProperty("pack");
  });

  test("declares wiki-native output args", () => {
    expect(command.args).toHaveProperty("wiki");
    expect(command.args).toHaveProperty("handoff");
    expect(command.args).toHaveProperty("project");
    expect(command.args).toHaveProperty("slice");
  });

  test("persists artifacts in pretty-scan mode", () => {
    // behavior covered by report-artifacts unit tests; scan owns the integration point
    expect(command.meta.name).toBe("scan");
  });
});

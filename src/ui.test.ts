import { describe, expect, test } from "bun:test";
import { humanCategory, humanRule } from "./ui";

describe("ui labels", () => {
  test("maps human-readable labels", () => {
    expect(humanRule("PRIVATE_MODULE_IMPORT")).toBe("Private cross-module import");
    expect(humanCategory("complexity")).toBe("Complexity");
  });
});

import { describe, expect, test } from "bun:test";
import { humanCategory, humanRule } from "./ui";

describe("ui labels", () => {
  test("maps human-readable labels", () => {
    expect(humanRule("PRIVATE_MODULE_IMPORT")).toBe("Private cross-module import");
    expect(humanRule("HANDWAVY_COMMENT")).toBe("Handwavy workaround comment");
    expect(humanRule("NOT_IMPLEMENTED_STUB")).toBe("Not-implemented JS/TS stub");
    expect(humanRule("DEAD_FEATURE_FLAG")).toBe("Dead feature flag");
    expect(humanCategory("complexity")).toBe("Complexity");
  });
});

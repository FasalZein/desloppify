import { describe, expect, test } from "bun:test";
import { GREP_EXTENDED_RULES, GREP_EXTENDED_RULE_CATALOG } from "./grep-extended-rules";

describe("grep-extended rule family", () => {
  test("exports catalog entries that stay aligned with rule definitions", () => {
    const ids = new Set(GREP_EXTENDED_RULES.map((rule) => rule.id));

    expect(ids.has("THROW_NON_ERROR")).toBe(true);
    expect(ids.has("CATCH_WRAP_NO_CAUSE")).toBe(true);
    expect(ids.has("HANDWAVY_COMMENT")).toBe(true);
    expect(ids.has("NOT_IMPLEMENTED_STUB")).toBe(true);
    expect(ids.has("DEAD_FEATURE_FLAG")).toBe(true);

    expect(GREP_EXTENDED_RULE_CATALOG.every((rule) => ids.has(rule.id))).toBe(true);
    expect(GREP_EXTENDED_RULE_CATALOG.find((rule) => rule.id === "THROW_NON_ERROR")?.tool).toBe("grep");
    expect(GREP_EXTENDED_RULE_CATALOG.map((rule) => rule.id)).not.toContain("MANY_USESTATE");
  });
});

import { describe, expect, test } from "bun:test";
import { GREP_PATTERN_RULES, GREP_PATTERN_RULE_CATALOG } from "./grep-pattern-rules";

describe("grep-pattern rule family", () => {
  test("exports catalog entries aligned with rule definitions", () => {
    const ids = new Set(GREP_PATTERN_RULES.map((rule) => rule.id));

    expect(ids.has("BANNER_COMMENT")).toBe(true);
    expect(ids.has("DEBUG_BREAKPOINT")).toBe(true);
    expect(ids.has("REDUNDANT_BOOLEAN_RETURN")).toBe(true);
    expect(ids.has("BOOLEAN_FLAG_PARAMS")).toBe(true);

    expect(GREP_PATTERN_RULE_CATALOG.every((rule) => ids.has(rule.id))).toBe(true);
    expect(GREP_PATTERN_RULE_CATALOG.find((rule) => rule.id === "DEBUG_BREAKPOINT")?.tool).toBe("grep");
  });
});

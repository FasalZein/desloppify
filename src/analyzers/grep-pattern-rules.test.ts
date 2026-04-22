import { describe, expect, test } from "bun:test";
import {
  GREP_PATTERN_RULE_CATALOG,
  GREP_PATTERN_RULE_FAMILIES,
  GREP_PATTERN_RULES,
} from "./grep-pattern-rules";

describe("grep-pattern rule family", () => {
  test("exports non-empty smell-family modules and preserves flat rule order", () => {
    const familyArrays = Object.values(GREP_PATTERN_RULE_FAMILIES);

    expect(familyArrays.every((rules) => rules.length > 0)).toBe(true);
    expect(new Set(GREP_PATTERN_RULES.map((rule) => rule.id)).size).toBe(GREP_PATTERN_RULES.length);
    expect(GREP_PATTERN_RULES.map((rule) => rule.id)).toEqual([
      "BANNER_COMMENT",
      "NARRATION_COMMENT",
      "APOLOGETIC_COMMENT",
      "OBVIOUS_JSX_LABEL",
      "TODO_REMOVE",
      "DEMO_PLACEHOLDER",
      "DEPRECATED_ANNOTATION",
      "HEDGING_COMMENT",
      "SECTION_LABEL_COMMENT",
      "INSTRUCTIONAL_COMMENT",
      "STATED_RETURN_COMMENT",
      "TRIPLE_NULL_GUARD",
      "EXPLICIT_TRUE_COMPARE",
      "RETURN_UNDEFINED",
      "PLACEHOLDER_VAR_NAME",
      "LOG_AND_RETHROW",
      "LINT_ESCAPE",
      "ENTRY_EXIT_LOG",
      "FIXME_HACK_XXX",
      "DEEP_NESTING",
      "NESTED_TERNARY",
      "HARDCODED_SECRET",
      "HARDCODED_URL",
      "SQL_INJECTION",
      "COMMENTED_CODE_BLOCK",
      "PLACEHOLDER_VALUE",
      "MIXED_IMPORT_STYLE",
      "CALLBACK_STYLE",
      "UNCHECKED_PROMISE",
      "HARDCODED_FAKE_DATA",
      "UNNECESSARY_INTERMEDIATE",
      "DEBUG_BREAKPOINT",
      "USEMEMO_EMPTY_DEPS",
      "FAKE_LOADING_DELAY",
      "UNNECESSARY_USECALLBACK",
      "REDUNDANT_BOOLEAN_RETURN",
      "UNDERSCORE_STATE",
      "BOOLEAN_FLAG_PARAMS",
      "REDUNDANT_CAST",
      "KEY_INDEX",
      "CLIENT_GENERATED_ID",
      "OR_CASCADE",
      "EMPTY_ARRAY_FALLBACK",
      "EMPTY_OBJECT_FALLBACK",
      "NOOP_LAMBDA_FALLBACK",
      "PROMISE_RESOLVE_FALLBACK",
    ]);
  });

  test("exports catalog entries aligned with rule definitions", () => {
    const ids = new Set(GREP_PATTERN_RULES.map((rule) => rule.id));

    expect(ids.has("BANNER_COMMENT")).toBe(true);
    expect(ids.has("DEBUG_BREAKPOINT")).toBe(true);
    expect(ids.has("REDUNDANT_BOOLEAN_RETURN")).toBe(true);
    expect(ids.has("BOOLEAN_FLAG_PARAMS")).toBe(true);
    expect(ids.has("EMPTY_ARRAY_FALLBACK")).toBe(true);

    expect(GREP_PATTERN_RULE_CATALOG.every((rule) => ids.has(rule.id))).toBe(true);
    expect(GREP_PATTERN_RULE_CATALOG.find((rule) => rule.id === "DEBUG_BREAKPOINT")?.tool).toBe("grep");
  });
});

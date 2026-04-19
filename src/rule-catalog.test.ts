import { describe, expect, test } from "bun:test";
import { BUILTIN_RULE_CATALOG } from "./rule-catalog";

describe("built-in rule catalog", () => {
  test("composes migrated grep families without duplicate ids", () => {
    const ids = BUILTIN_RULE_CATALOG.map((rule) => rule.id);

    expect(ids).toEqual(expect.arrayContaining([
      "BANNER_COMMENT",
      "DEBUG_BREAKPOINT",
      "HANDWAVY_COMMENT",
      "THROW_NON_ERROR",
      "CATCH_WRAP_NO_CAUSE",
    ]));

    expect(new Set(ids).size).toBe(ids.length);
  });
});

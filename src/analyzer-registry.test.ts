import { describe, expect, test } from "bun:test";
import { runBuiltinTextAnalyzers } from "./analyzer-registry";
import type { FileEntry } from "./analyzers/file-walker";

function entry(path: string, content: string): FileEntry {
  return { path, content, lines: content.split("\n") };
}

describe("analyzer registry", () => {
  test("composes migrated grep families through one shared path", () => {
    const issues = runBuiltinTextAnalyzers([
      entry("/repo/src/main.ts", "const data2 = input;\n// quick fix\nconst ready = value === true;"),
    ]);

    expect(issues.map((issue) => issue.id)).toEqual(expect.arrayContaining([
      "PLACEHOLDER_VAR_NAME",
      "HANDWAVY_COMMENT",
      "EXPLICIT_TRUE_COMPARE",
    ]));
  });

  test("can target a single built-in text analyzer family", () => {
    const issues = runBuiltinTextAnalyzers([
      entry("/repo/src/main.ts", "const data2 = input;\n// quick fix\nconst ready = value === true;"),
    ], { ids: ["grep-patterns"] });

    expect(issues.map((issue) => issue.id)).toContain("PLACEHOLDER_VAR_NAME");
    expect(issues.map((issue) => issue.id)).toContain("EXPLICIT_TRUE_COMPARE");
    expect(issues.map((issue) => issue.id)).not.toContain("HANDWAVY_COMMENT");
  });
});

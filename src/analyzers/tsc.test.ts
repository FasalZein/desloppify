import { describe, expect, test } from "bun:test";
import { parseTscIssues } from "./tsc";

describe("tsc parser", () => {
  test("captures line, column, and stable delta identity for implicit any errors", () => {
    const issues = parseTscIssues([
      "src/example.ts(12,34): error TS7006: Parameter 'value' implicitly has an 'any' type.",
      "src/other.ts(1,2): error TS7008: Member 'name' implicitly has an 'any' type.",
    ].join("\n"));

    expect(issues).toEqual([
      expect.objectContaining({
        file: "src/example.ts",
        line: 12,
        column: 34,
        deltaIdentity: "TS7006:Parameter 'value' implicitly has an 'any' type.",
      }),
      expect.objectContaining({
        file: "src/other.ts",
        line: 1,
        column: 2,
        deltaIdentity: "TS7008:Member 'name' implicitly has an 'any' type.",
      }),
    ]);
  });
});

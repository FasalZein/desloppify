import { describe, expect, test } from "bun:test";
import { calculateScore, getGrade } from "./score";
import type { Issue } from "../types";

function issue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "TEST_RULE",
    category: "dead-code",
    severity: "CRITICAL",
    tier: 0,
    file: "/repo/src/example.ts",
    line: 1,
    message: "test issue",
    tool: "grep",
    ...overrides,
  };
}

describe("calculateScore", () => {
  test("caps category penalties", () => {
    const issues = Array.from({ length: 10 }, () => issue());
    const result = calculateScore(issues);

    expect(result.penalty).toBe(20);
    expect(result.score).toBe(80);
    expect(result.grade).toBe("B");
  });

  test("uses weighted categories", () => {
    const result = calculateScore([
      issue({ category: "security-slop", severity: "HIGH" }),
      issue({ category: "ai-slop", severity: "LOW" }),
    ]);

    expect(result.penalty).toBe(6.25);
    expect(result.score).toBe(94);
    expect(result.grade).toBe("A");
  });
});

describe("getGrade", () => {
  test("maps score ranges", () => {
    expect(getGrade(96)).toBe("A+");
    expect(getGrade(85)).toBe("A");
    expect(getGrade(70)).toBe("B");
    expect(getGrade(50)).toBe("C");
    expect(getGrade(30)).toBe("D");
    expect(getGrade(29)).toBe("F");
  });
});

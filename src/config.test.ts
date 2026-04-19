import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyConfigToIssues, getConfigExample, getRuleScoreWeight, getRuleSeverityOverride, isRuleEnabled, loadDesloppifyConfig } from "./config";
import type { Issue } from "./types";

let tempRoot: string | undefined;

afterEach(() => {
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = undefined;
});

function issue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "TEST_RULE",
    category: "dead-code",
    severity: "MEDIUM",
    tier: 1,
    file: "/repo/src/example.ts",
    line: 3,
    message: "test issue",
    tool: "grep",
    ...overrides,
  };
}

describe("config", () => {
  test("loads repo config variants when present", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-config-"));
    writeFileSync(join(tempRoot, ".desloppifyrc"), JSON.stringify({ rules: { TEST_RULE: { enabled: false } } }));

    const loaded = loadDesloppifyConfig(tempRoot);

    expect(loaded.path).toBe(join(tempRoot, ".desloppifyrc"));
    expect(isRuleEnabled(loaded.config, "TEST_RULE")).toBe(false);
  });

  test("applies top-level and file-pattern overrides to issues", () => {
    const issues = [
      issue({ id: "DISABLED_RULE", file: "/repo/src/disabled.ts" }),
      issue({ id: "SEVERITY_RULE", file: "/repo/src/normal.ts" }),
      issue({ id: "WEIGHT_RULE", file: "/repo/src/normal.ts" }),
      issue({ id: "OVERRIDDEN_RULE", file: "/repo/src/rules/internal.ts" }),
    ];

    const applied = applyConfigToIssues(issues, {
      rules: {
        DISABLED_RULE: { enabled: false },
        SEVERITY_RULE: { severity: "HIGH" },
        WEIGHT_RULE: { weight: 2 },
      },
      overrides: [
        {
          files: ["src/rules/**"],
          rules: {
            OVERRIDDEN_RULE: { enabled: false },
          },
        },
      ],
    }, "/repo");

    expect(applied.map((item) => item.id)).not.toContain("DISABLED_RULE");
    expect(applied.map((item) => item.id)).not.toContain("OVERRIDDEN_RULE");
    expect(applied.find((item) => item.id === "SEVERITY_RULE")?.severity).toBe("HIGH");
    expect(applied.find((item) => item.id === "WEIGHT_RULE")?.scoreWeight).toBe(2);
  });

  test("exposes helper lookups and example config", () => {
    const config = { rules: { TEST_RULE: { severity: "CRITICAL", weight: 1.5 } } };
    expect(getRuleSeverityOverride(config, "TEST_RULE")).toBe("CRITICAL");
    expect(getRuleScoreWeight(config, "TEST_RULE")).toBe(1.5);
    expect(getConfigExample()).toContain("CONSOLE_LOG");
  });
});

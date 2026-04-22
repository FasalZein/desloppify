import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyConfigToIssues, getConfigExample, getRuleScoreWeight, getRuleSeverityOverride, isRuleEnabled, loadDesloppifyConfig, resolveRuleOverride } from "./config";
import type { DesloppifyConfig } from "./config-types";
import type { Issue } from "./types";

const pluginApiPath = join(process.cwd(), "src/plugin-api.ts");

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

  test("loads cjs config modules", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-config-cjs-"));
    writeFileSync(join(tempRoot, "desloppify.config.cjs"), "module.exports = { rules: { TEST_RULE: { severity: 'HIGH' } } };\n");

    const loaded = loadDesloppifyConfig(tempRoot);

    expect(loaded.path).toBe(join(tempRoot, "desloppify.config.cjs"));
    expect(getRuleSeverityOverride(loaded.config, "TEST_RULE")).toBe("HIGH");
  });

  test("merges local and plugin extends before applying root config", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-config-extends-"));
    writeFileSync(join(tempRoot, "base.json"), JSON.stringify({
      rules: {
        TEST_RULE: { severity: "HIGH", weight: 1.5 },
        BASE_ONLY: { enabled: false },
      },
      overrides: [{ files: ["src/rules/**"], rules: { TEST_RULE: { enabled: false } } }],
    }));
    writeFileSync(join(tempRoot, "plugin.cjs"), `const { definePlugin, PLUGIN_API_VERSION } = require(${JSON.stringify(pluginApiPath)}); module.exports = definePlugin({ meta: { name: 'local-plugin', apiVersion: PLUGIN_API_VERSION, namespace: 'local' }, configs: { recommended: { rules: { PLUGIN_RULE: { enabled: false }, 'local/contains-token': { options: { token: 'BETA' } } } } } });`);
    writeFileSync(join(tempRoot, "desloppify.config.json"), JSON.stringify({
      plugins: { local: "./plugin.cjs" },
      extends: ["./base.json", "plugin:local/recommended"],
      rules: {
        TEST_RULE: { severity: "CRITICAL" },
        "local/contains-token": { options: { token: "ACME", replacement: "safeToken" } },
      },
    }));

    const loaded = loadDesloppifyConfig(tempRoot);

    expect(loaded.config.rules?.TEST_RULE).toEqual({ severity: "CRITICAL", weight: 1.5 });
    expect(loaded.config.rules?.BASE_ONLY).toEqual({ enabled: false });
    expect(loaded.config.rules?.PLUGIN_RULE).toEqual({ enabled: false });
    expect(loaded.config.rules?.["local/contains-token"]?.options).toEqual({ token: "ACME", replacement: "safeToken" });
    expect(loaded.config.overrides).toHaveLength(1);
  });

  test("throws on extends cycles", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-config-cycle-"));
    writeFileSync(join(tempRoot, "a.json"), JSON.stringify({ extends: ["./b.json"] }));
    writeFileSync(join(tempRoot, "b.json"), JSON.stringify({ extends: ["./a.json"] }));
    writeFileSync(join(tempRoot, "desloppify.config.json"), JSON.stringify({ extends: ["./a.json"] }));

    expect(() => loadDesloppifyConfig(tempRoot!)).toThrow("Config extends cycle detected");
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

  test("merges top-level and file-specific rule options", () => {
    const config: DesloppifyConfig = {
      rules: {
        "local/contains-token": { options: { token: "ACME", replacement: "safeToken" } },
      },
      overrides: [{
        files: ["src/tests/**"],
        rules: {
          "local/contains-token": { options: { token: "FIXTURE" }, severity: "LOW" },
        },
      }],
    };

    const override = resolveRuleOverride(config, "local/contains-token", "/repo/src/tests/example.ts", "/repo");

    expect(override?.severity).toBe("LOW");
    expect(override?.options).toEqual({ token: "FIXTURE", replacement: "safeToken" });
  });

  test("exposes helper lookups and example config", () => {
    const config: DesloppifyConfig = { rules: { TEST_RULE: { severity: "CRITICAL", weight: 1.5 } } };
    expect(getRuleSeverityOverride(config, "TEST_RULE")).toBe("CRITICAL");
    expect(getRuleScoreWeight(config, "TEST_RULE")).toBe(1.5);
    expect(getConfigExample()).toContain("plugin:local/recommended");
    expect(getConfigExample()).toContain("desloppify.plugin.cjs");
    expect(getConfigExample()).toContain('"options"');
  });
});

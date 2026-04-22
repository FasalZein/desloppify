import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getConfigPluginRuleCatalog, loadConfiguredPlugins, loadConfigPluginRules, resolvePluginConfigExtends, runConfigPluginRules } from "./plugin-rules";
import type { FileEntry } from "./analyzers/file-walker";

const pluginApiPath = join(process.cwd(), "src/plugin-api.ts");

let tempRoot: string | undefined;

afterEach(() => {
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = undefined;
});

describe("plugin rules", () => {
  test("loads plugin rules from config-declared local files", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-plugin-"));
    writeFileSync(join(tempRoot, "plugin.cjs"), `const { definePlugin, PLUGIN_API_VERSION } = require(${JSON.stringify(pluginApiPath)}); module.exports = definePlugin({ meta: { name: 'local-plugin', apiVersion: PLUGIN_API_VERSION, namespace: 'local' }, rules: [{ id: 'contains-acme', category: 'ai-slop', severity: 'MEDIUM', message: 'Contains {{token}}', description: 'Contains {{token}} marker', pattern: '{{token}}', options: { token: { type: 'string', default: 'ACME' } } }] });`);

    const loaded = loadConfigPluginRules({ plugins: { local: "./plugin.cjs" } }, tempRoot);
    expect(loaded[0]?.id).toBe("local/contains-acme");
    expect(getConfigPluginRuleCatalog(loaded)[0]?.desc).toBe("Contains ACME marker");
  });

  test("resolves plugin preset configs from extends refs", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-plugin-config-"));
    writeFileSync(join(tempRoot, "plugin.cjs"), `const { definePlugin, PLUGIN_API_VERSION } = require(${JSON.stringify(pluginApiPath)}); module.exports = definePlugin({ meta: { name: 'local-plugin', apiVersion: PLUGIN_API_VERSION, namespace: 'local' }, configs: { recommended: { rules: { CONSOLE_LOG: { enabled: false }, 'local/contains-acme': { options: { token: 'BETA' } } } } } });`);

    const config = { plugins: { local: "./plugin.cjs" } };
    const resolved = resolvePluginConfigExtends(["plugin:local/recommended"], config, tempRoot);

    expect(resolved.rules?.CONSOLE_LOG).toEqual({ enabled: false });
    expect(resolved.rules?.["local/contains-acme"]?.options).toEqual({ token: "BETA" });
    expect(loadConfiguredPlugins(config, tempRoot)).toHaveLength(1);
  });

  test("rejects module plugins with namespace mismatch", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-plugin-mismatch-"));
    writeFileSync(join(tempRoot, "plugin.cjs"), `const { definePlugin, PLUGIN_API_VERSION } = require(${JSON.stringify(pluginApiPath)}); module.exports = definePlugin({ meta: { name: 'local-plugin', apiVersion: PLUGIN_API_VERSION, namespace: 'wrong' }, rules: [{ id: 'contains-acme', category: 'ai-slop', severity: 'MEDIUM', message: 'Contains ACME', pattern: 'ACME' }] });`);

    expect(() => loadConfigPluginRules({ plugins: { local: "./plugin.cjs" } }, tempRoot!)).toThrow("Plugin namespace mismatch");
  });

  test("runs plugin regex rules against matching files", () => {
    const entries: FileEntry[] = [{ path: "/repo/src/example.ts", content: "const x = 'ACME';", lines: ["const x = 'ACME';"] }];
    const issues = runConfigPluginRules(entries, [{
      id: "local/contains-acme",
      category: "ai-slop",
      severity: "MEDIUM",
      description: "Contains ACME marker",
      patternTemplate: "ACME",
      messageTemplate: "Contains ACME",
      flagsTemplate: "",
      fileTemplates: ["src/**"],
      tier: 0,
      tool: "plugin:local",
      identityGroup: 0,
      optionSpecs: {},
      defaultOptions: {},
    }], {}, "/repo");

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ id: "local/contains-acme", line: 1, severity: "MEDIUM", deltaIdentity: "ACME" });
  });

  test("propagates plugin fix text into emitted issues", () => {
    const entries: FileEntry[] = [{ path: "/repo/src/example.ts", content: "const x = 'ACME';", lines: ["const x = 'ACME';"] }];
    const issues = runConfigPluginRules(entries, [{
      id: "local/contains-acme",
      category: "ai-slop",
      severity: "MEDIUM",
      description: "Contains ACME marker",
      patternTemplate: "ACME",
      messageTemplate: "Contains ACME",
      fixTemplate: "Remove the ACME marker",
      flagsTemplate: "",
      fileTemplates: ["src/**"],
      tier: 1,
      tool: "plugin:local",
      identityGroup: 0,
      optionSpecs: {},
      defaultOptions: {},
    }], {}, "/repo");

    expect(issues[0]?.fix).toBe("Remove the ACME marker");
  });

  test("uses plugin identityGroup for stable delta identity", () => {
    const entries: FileEntry[] = [{ path: "/repo/src/example.ts", content: 'const userId = "abc-123";', lines: ['const userId = "abc-123";'] }];
    const issues = runConfigPluginRules(entries, [{
      id: "local/raw-id",
      category: "ai-slop",
      severity: "LOW",
      description: "Raw ID literal",
      patternTemplate: 'userId = "([^"]+)"',
      messageTemplate: "Raw ID literal",
      flagsTemplate: "",
      fileTemplates: ["src/**"],
      tier: 0,
      tool: "plugin:local",
      identityGroup: 1,
      optionSpecs: {},
      defaultOptions: {},
    }], {}, "/repo");

    expect(issues[0]?.deltaIdentity).toBe("abc-123");
  });

  test("emits multiple matches from one line when plugin regex is global", () => {
    const entries: FileEntry[] = [{
      path: "/repo/src/example.ts",
      content: 'const tokens = ["ACME", "BETA"];',
      lines: ['const tokens = ["ACME", "BETA"];'],
    }];
    const issues = runConfigPluginRules(entries, [{
      id: "local/raw-token",
      category: "ai-slop",
      severity: "LOW",
      description: "Raw token literal",
      patternTemplate: '"([A-Z]+)"',
      messageTemplate: "Raw token literal",
      flagsTemplate: "g",
      fileTemplates: ["src/**"],
      tier: 0,
      tool: "plugin:local",
      identityGroup: 1,
      optionSpecs: {},
      defaultOptions: {},
    }], {}, "/repo");

    expect(issues).toHaveLength(2);
    expect(issues.map((issue) => issue.deltaIdentity)).toEqual(["ACME", "BETA"]);
  });

  test("applies configured plugin options at runtime", () => {
    const entries: FileEntry[] = [{ path: "/repo/src/example.ts", content: "const token = 'BETA';", lines: ["const token = 'BETA';"] }];
    const issues = runConfigPluginRules(entries, [{
      id: "local/contains-token",
      category: "ai-slop",
      severity: "LOW",
      description: "Contains token marker",
      patternTemplate: "{{token}}",
      messageTemplate: "Contains {{token}}",
      fixTemplate: "Replace {{token}}",
      flagsTemplate: "",
      fileTemplates: ["src/**"],
      tier: 0,
      tool: "plugin:local",
      identityGroup: 0,
      optionSpecs: {
        token: { type: "string", default: "ACME" },
      },
      defaultOptions: { token: "ACME" },
    }], {
      rules: {
        "local/contains-token": { options: { token: "BETA" } },
      },
    }, "/repo");

    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toBe("Contains BETA");
    expect(issues[0]?.fix).toBe("Replace BETA");
    expect(issues[0]?.deltaIdentity).toBe("BETA");
  });

  test("applies file-specific plugin option overrides", () => {
    const entries: FileEntry[] = [{ path: "/repo/test/example.ts", content: "const token = 'FIXTURE';", lines: ["const token = 'FIXTURE';"] }];
    const issues = runConfigPluginRules(entries, [{
      id: "local/contains-token",
      category: "ai-slop",
      severity: "LOW",
      description: "Contains token marker",
      patternTemplate: "{{token}}",
      messageTemplate: "Contains {{token}}",
      flagsTemplate: "",
      fileTemplates: ["**/*.ts"],
      tier: 0,
      tool: "plugin:local",
      identityGroup: 0,
      optionSpecs: {
        token: { type: "string", default: "ACME" },
      },
      defaultOptions: { token: "ACME" },
    }], {
      overrides: [{
        files: ["test/**"],
        rules: {
          "local/contains-token": { options: { token: "FIXTURE" } },
        },
      }],
    }, "/repo");

    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toBe("Contains FIXTURE");
  });

  test("rejects unknown plugin rule options from config", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-plugin-options-"));
    writeFileSync(join(tempRoot, "plugin.cjs"), `const { definePlugin, PLUGIN_API_VERSION } = require(${JSON.stringify(pluginApiPath)}); module.exports = definePlugin({ meta: { name: 'local-plugin', apiVersion: PLUGIN_API_VERSION, namespace: 'local' }, rules: [{ id: 'contains-token', category: 'ai-slop', severity: 'LOW', message: 'Contains {{token}}', pattern: '{{token}}', options: { token: { type: 'string', default: 'ACME' } } }] });`);

    expect(() => loadConfigPluginRules({
      plugins: { local: "./plugin.cjs" },
      rules: {
        "local/contains-token": { options: { wrong: "BETA" } },
      },
    }, tempRoot!)).toThrow("Unknown plugin rule option");
  });
});

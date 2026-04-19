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
    writeFileSync(join(tempRoot, "plugin.cjs"), `const { definePlugin, PLUGIN_API_VERSION } = require(${JSON.stringify(pluginApiPath)}); module.exports = definePlugin({ meta: { name: 'local-plugin', apiVersion: PLUGIN_API_VERSION, namespace: 'local' }, rules: [{ id: 'contains-acme', category: 'ai-slop', severity: 'MEDIUM', message: 'Contains ACME', description: 'Contains ACME marker', pattern: 'ACME' }] });`);

    const loaded = loadConfigPluginRules({ plugins: { local: "./plugin.cjs" } }, tempRoot);
    expect(loaded[0]?.id).toBe("local/contains-acme");
    expect(getConfigPluginRuleCatalog(loaded)[0]?.desc).toBe("Contains ACME marker");
  });

  test("resolves plugin preset configs from extends refs", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-plugin-config-"));
    writeFileSync(join(tempRoot, "plugin.cjs"), `const { definePlugin, PLUGIN_API_VERSION } = require(${JSON.stringify(pluginApiPath)}); module.exports = definePlugin({ meta: { name: 'local-plugin', apiVersion: PLUGIN_API_VERSION, namespace: 'local' }, configs: { recommended: { rules: { CONSOLE_LOG: { enabled: false } } } } });`);

    const config = { plugins: { local: "./plugin.cjs" } };
    const resolved = resolvePluginConfigExtends(["plugin:local/recommended"], config, tempRoot);

    expect(resolved.rules?.CONSOLE_LOG).toEqual({ enabled: false });
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
      message: "Contains ACME",
      description: "Contains ACME marker",
      regex: /ACME/,
      files: ["src/**"],
      tier: 0,
      tool: "plugin:local",
    }], "/repo");

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ id: "local/contains-acme", line: 1, severity: "MEDIUM" });
  });
});

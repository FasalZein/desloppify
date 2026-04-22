import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfiguredPlugins, resolvePluginConfigExtends } from "./plugin-loader";

const pluginApiPath = join(process.cwd(), "src/plugin-api.ts");

let tempRoot: string | undefined;

afterEach(() => {
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = undefined;
});

describe("plugin loader", () => {
  test("loads configured plugins and resolves plugin preset extends", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-plugin-loader-"));
    writeFileSync(join(tempRoot, "plugin.cjs"), `const { definePlugin, PLUGIN_API_VERSION } = require(${JSON.stringify(pluginApiPath)}); module.exports = definePlugin({ meta: { name: 'local-plugin', apiVersion: PLUGIN_API_VERSION, namespace: 'local' }, rules: [{ id: 'contains-acme', category: 'ai-slop', severity: 'MEDIUM', message: 'Contains {{token}}', pattern: '{{token}}', options: { token: { type: 'string', default: 'ACME' } } }], configs: { recommended: { rules: { CONSOLE_LOG: { enabled: false }, 'local/contains-acme': { options: { token: 'BETA' } } } } } });`);

    const config = { plugins: { local: "./plugin.cjs" } };
    const loaded = loadConfiguredPlugins(config, tempRoot);
    const resolved = resolvePluginConfigExtends(["plugin:local/recommended"], config, tempRoot);

    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.namespace).toBe("local");
    expect(loaded[0]?.plugin.rules?.[0]?.id).toBe("contains-acme");
    expect(resolved.rules?.CONSOLE_LOG).toEqual({ enabled: false });
    expect(resolved.rules?.["local/contains-acme"]?.options).toEqual({ token: "BETA" });
  });

  test("loads packaged plugins from node_modules", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-plugin-package-"));
    writeFileSync(join(tempRoot, "package.json"), '{"name":"fixture-root"}');
    const pkgRoot = join(tempRoot, "node_modules", "desloppify-plugin-demo");
    mkdirSync(pkgRoot, { recursive: true });
    writeFileSync(join(pkgRoot, "package.json"), '{"name":"desloppify-plugin-demo","main":"index.cjs"}');
    writeFileSync(join(pkgRoot, "index.cjs"), `const { definePlugin, PLUGIN_API_VERSION } = require(${JSON.stringify(pluginApiPath)}); module.exports = definePlugin({ meta: { name: 'demo-plugin', apiVersion: PLUGIN_API_VERSION, namespace: 'demo' }, rules: [{ id: 'contains-demo', category: 'ai-slop', severity: 'MEDIUM', message: 'Contains DEMO', pattern: 'DEMO' }] });`);

    const loaded = loadConfiguredPlugins({ plugins: { demo: "desloppify-plugin-demo" } }, tempRoot);

    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.namespace).toBe("demo");
    expect(loaded[0]?.plugin.rules?.[0]?.id).toBe("contains-demo");
  });

  test("rejects plugin rules with invalid option defaults", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-plugin-invalid-options-"));
    writeFileSync(join(tempRoot, "plugin.cjs"), `const { definePlugin, PLUGIN_API_VERSION } = require(${JSON.stringify(pluginApiPath)}); module.exports = definePlugin({ meta: { name: 'bad-plugin', apiVersion: PLUGIN_API_VERSION, namespace: 'bad' }, rules: [{ id: 'contains-bad', category: 'ai-slop', severity: 'MEDIUM', message: 'Contains BAD', pattern: 'BAD', options: { token: { type: 'number', default: 'BAD' } } }] });`);

    expect(() => loadConfiguredPlugins({ plugins: { bad: "./plugin.cjs" } }, tempRoot!)).toThrow("Plugin rule option default type mismatch");
  });
});

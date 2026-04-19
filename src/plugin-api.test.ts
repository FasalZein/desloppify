import { describe, expect, test } from "bun:test";
import { definePlugin, PLUGIN_API_VERSION } from "./plugin-api";

describe("plugin api", () => {
  test("definePlugin returns the authored plugin contract", () => {
    const plugin = definePlugin({
      meta: { name: "acme", apiVersion: PLUGIN_API_VERSION, namespace: "acme" },
      rules: [{ id: "contains-word", category: "ai-slop", severity: "MEDIUM", message: "Contains word", pattern: "word" }],
      configs: { recommended: { rules: { "acme/contains-word": { weight: 1.5 } } } },
    });

    expect(plugin.meta.apiVersion).toBe(PLUGIN_API_VERSION);
    expect(plugin.configs?.recommended?.rules?.["acme/contains-word"]?.weight).toBe(1.5);
  });
});

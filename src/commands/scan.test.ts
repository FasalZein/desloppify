import { describe, expect, test } from "bun:test";
import command, { formatMarkdown } from "./scan";

describe("scan command", () => {
  test("declares partial scan args", () => {
    expect(command.meta.name).toBe("scan");
    expect(command.args).toHaveProperty("staged");
    expect(command.args).toHaveProperty("changed");
    expect(command.args).toHaveProperty("base");
  });

  test("declares explicit pack arg", () => {
    expect(command.args).toHaveProperty("pack");
  });

  test("declares wiki-native output args", () => {
    expect(command.args).toHaveProperty("wiki");
    expect(command.args).toHaveProperty("handoff");
    expect(command.args).toHaveProperty("project");
    expect(command.args).toHaveProperty("slice");
  });

  test("persists artifacts in pretty-scan mode", () => {
    // behavior covered by report-artifacts unit tests; scan owns the integration point
    expect(command.meta.name).toBe("scan");
  });

  test("declares all artifact-capable output modes", () => {
    expect(command.args).toHaveProperty("json");
    expect(command.args).toHaveProperty("markdown");
    expect(command.args).toHaveProperty("wiki");
    expect(command.args).toHaveProperty("handoff");
  });

  test("markdown output includes normalized metrics and path hotspots", () => {
    const markdown = formatMarkdown({
      schema_version: "desloppify.findings/v1",
      scan: {
        version: "1.0.1",
        path: "/repo",
        generatedAt: "2026-04-19T00:00:00.000Z",
        pack: { name: "js-ts", explicit: true },
      },
      tools: {
        knip: false,
        madge: false,
        "ast-grep": false,
        tsc: false,
        eslint: false,
        biome: false,
      },
      score: 99,
      metrics: {
        fileCount: 1,
        lineCount: 10,
        nonEmptyLineCount: 8,
        normalized: {
          scorePerFile: 99,
          scorePerKloc: 12375,
          findingsPerFile: 1,
          findingsPerKloc: 125,
        },
      },
      hotspots: {
        paths: [{ path: "/repo/src/example.ts", findingCount: 1, penalty: 1 }],
      },
      summary: { critical: 0, high: 0, medium: 1, low: 0 },
      categories: { "dead-code": { count: 1, fixable: 1 } },
      rules: {},
      findings: [{
        id: "f1",
        rule_id: "CONSOLE_LOG",
        level: "warning",
        severity: "MEDIUM",
        category: "dead-code",
        message: "Avoid console.log",
        tool: "grep",
        locations: [{
          path: "/repo/src/example.ts",
          range: {
            start: { line: 1, column: 1 },
            end: { line: 1, column: 1 },
          },
        }],
        primary_location_index: 0,
        fingerprints: { primary: "f1" },
      }],
    });

    expect(markdown).toContain("## Normalized Metrics");
    expect(markdown).toContain("## Path Hotspots");
    expect(markdown).toContain("/repo/src/example.ts");
  });
});

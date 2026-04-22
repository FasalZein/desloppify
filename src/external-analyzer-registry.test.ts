import { describe, expect, test } from "bun:test";
import { getExternalTasks, listExternalAnalyzerIds, type ExternalAnalyzerDefinition } from "./external-analyzer-registry";
import type { ToolStatus } from "./types";

const allTools: ToolStatus = {
  knip: true,
  madge: true,
  "ast-grep": true,
  tsc: true,
  eslint: true,
  biome: true,
  oxlint: true,
  ruff: true,
  "cargo-clippy": true,
  staticcheck: true,
  "golangci-lint": true,
  rubocop: true,
};

describe("external analyzer registry", () => {
  test("lists enabled analyzer ids from generic definitions without pack routing", () => {
    const analyzers: ExternalAnalyzerDefinition<"alpha" | "beta">[] = [
      {
        id: "alpha",
        enabled: (tools, options) => tools.knip && !options.category,
        createTask: (targetPath) => ({ name: `alpha:${targetPath}`, promise: Promise.resolve({ issues: [] }) }),
      },
      {
        id: "beta",
        enabled: (tools, options) => tools.madge && options.category === "circular-deps",
        createTask: (targetPath) => ({ name: `beta:${targetPath}`, promise: Promise.resolve({ issues: [] }) }),
      },
    ];

    expect(listExternalAnalyzerIds(analyzers, allTools)).toEqual(["alpha"]);
    expect(listExternalAnalyzerIds(analyzers, allTools, { category: "circular-deps" })).toEqual(["beta"]);
    expect(listExternalAnalyzerIds(analyzers, allTools, { partial: true })).toEqual([]);
  });

  test("creates tasks from generic definitions after filtering", () => {
    const analyzers: ExternalAnalyzerDefinition<"alpha" | "beta">[] = [
      {
        id: "alpha",
        enabled: () => true,
        createTask: (targetPath) => ({ name: `alpha:${targetPath}`, promise: Promise.resolve({ issues: [] }) }),
      },
      {
        id: "beta",
        enabled: (_, options) => Boolean(options.withMadge),
        createTask: (targetPath) => ({ name: `beta:${targetPath}`, promise: Promise.resolve({ issues: [] }) }),
      },
    ];

    expect(getExternalTasks(analyzers, "/repo", allTools).map((task) => task.name)).toEqual(["alpha:/repo"]);
    expect(getExternalTasks(analyzers, "/repo", allTools, { withMadge: true }).map((task) => task.name)).toEqual([
      "alpha:/repo",
      "beta:/repo",
    ]);
    expect(getExternalTasks(analyzers, "/repo", allTools, { partial: true })).toEqual([]);
  });
});

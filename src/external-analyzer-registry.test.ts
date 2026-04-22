import { describe, expect, test } from "bun:test";
import { listBuiltinExternalAnalyzerIds } from "./external-analyzer-registry";
import { getBuiltinPackDefinition } from "./pack-registry";
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
  test("keeps madge opt-in for uncategorized js-ts scans", () => {
    expect(listBuiltinExternalAnalyzerIds("js-ts", allTools)).toEqual(["knip", "ast-grep", "tsc", "eslint", "biome", "oxlint"]);
    expect(listBuiltinExternalAnalyzerIds("js-ts", allTools, { withMadge: true })).toEqual(["knip", "madge", "ast-grep", "tsc", "eslint", "biome", "oxlint"]);
  });

  test("applies pack/category/partial filtering before task creation", () => {
    expect(listBuiltinExternalAnalyzerIds("js-ts", allTools, { category: "dead-code" })).toEqual(["knip", "ast-grep"]);
    expect(listBuiltinExternalAnalyzerIds("js-ts", allTools, { category: "circular-deps" })).toEqual(["madge"]);
    expect(listBuiltinExternalAnalyzerIds("python", allTools)).toEqual(["ast-grep", "ruff"]);
    expect(listBuiltinExternalAnalyzerIds("rust", allTools)).toEqual(["ast-grep", "cargo-clippy"]);
    expect(listBuiltinExternalAnalyzerIds("go", allTools)).toEqual(["staticcheck", "golangci-lint"]);
    expect(listBuiltinExternalAnalyzerIds("ruby", allTools)).toEqual(["rubocop"]);
    expect(listBuiltinExternalAnalyzerIds("js-ts", allTools, { partial: true })).toEqual([]);
  });

  test("canonical pack definitions delegate external analyzer selection", () => {
    const jsDefinition = getBuiltinPackDefinition("js-ts");
    const pythonDefinition = getBuiltinPackDefinition("python");

    expect(jsDefinition.listExternalAnalyzerIds(allTools, { withMadge: true })).toEqual(
      listBuiltinExternalAnalyzerIds("js-ts", allTools, { withMadge: true }),
    );
    expect(pythonDefinition.listExternalAnalyzerIds(allTools)).toEqual(
      listBuiltinExternalAnalyzerIds("python", allTools),
    );
  });
});

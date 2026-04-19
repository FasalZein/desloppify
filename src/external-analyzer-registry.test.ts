import { describe, expect, test } from "bun:test";
import { listBuiltinExternalAnalyzerIds } from "./external-analyzer-registry";
import type { ToolStatus } from "./types";

const allTools: ToolStatus = {
  knip: true,
  madge: true,
  "ast-grep": true,
  tsc: true,
  eslint: true,
  biome: true,
};

describe("external analyzer registry", () => {
  test("composes js-ts external analyzers through one shared path", () => {
    expect(listBuiltinExternalAnalyzerIds("js-ts", allTools)).toEqual(["knip", "madge", "ast-grep", "tsc"]);
  });

  test("applies pack/category/partial filtering before task creation", () => {
    expect(listBuiltinExternalAnalyzerIds("js-ts", allTools, { category: "dead-code" })).toEqual(["knip", "ast-grep"]);
    expect(listBuiltinExternalAnalyzerIds("python", allTools)).toEqual(["ast-grep"]);
    expect(listBuiltinExternalAnalyzerIds("js-ts", allTools, { partial: true })).toEqual([]);
  });
});

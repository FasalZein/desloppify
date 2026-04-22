import { describe, expect, test } from "bun:test";
import { getBuiltinPackDefinition, listBuiltinPackDefinitions } from "./pack-registry";
import type { FileEntry } from "./analyzers/file-walker";
import type { ToolStatus } from "./types";

function entry(path: string, content: string): FileEntry {
  return { path, content, lines: content.split("\n") };
}

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

describe("pack registry", () => {
  test("exposes canonical built-in pack definitions", () => {
    const jsTs = getBuiltinPackDefinition("js-ts");
    const python = getBuiltinPackDefinition("python");
    const rust = getBuiltinPackDefinition("rust");

    expect({ ...jsTs.meta }).toMatchObject({
      name: "js-ts",
      description: expect.stringContaining("JavaScript"),
      projectSignals: ["javascript", "typescript", "react"],
    });
    expect({ ...python.meta }).toMatchObject({
      name: "python",
      description: expect.stringContaining("Python"),
      projectSignals: ["python"],
    });
    expect({ ...rust.meta }).toMatchObject({
      name: "rust",
      description: expect.stringContaining("Rust"),
      projectSignals: ["rust"],
    });
    expect(listBuiltinPackDefinitions().map((definition) => definition.meta.name)).toEqual(["js-ts", "python", "rust", "go", "ruby"]);
  });

  test("runs built-in pack internal analyzers through registry definitions", () => {
    const entries = [
      entry("/repo/app.py", "# ====================\ndef run(items=[]):\n  return items\nlist = []"),
      entry("/repo/view.tsx", "useEffect(async () => { await load(); }, []);"),
      entry("/repo/main.rs", "fn main() { value.unwrap(); }"),
    ];

    const pythonDefinition = getBuiltinPackDefinition("python");
    const jsDefinition = getBuiltinPackDefinition("js-ts");
    const rustDefinition = getBuiltinPackDefinition("rust");

    const pythonIssues = pythonDefinition.runInternal(entries);
    const jsIssues = jsDefinition.runInternal(entries);
    const rustIssues = rustDefinition.runInternal(entries);

    expect(pythonIssues.map((issue) => issue.id)).toEqual(expect.arrayContaining(["BANNER_COMMENT", "MUTABLE_DEFAULT", "BUILTIN_SHADOW"]));
    expect(jsIssues.map((issue) => issue.id)).toContain("USEEFFECT_ASYNC");
    expect(rustIssues).toEqual([]);
    expect(jsDefinition.listExternalAnalyzerIds(allTools)).toEqual(["knip", "ast-grep", "tsc", "eslint", "biome", "oxlint"]);
    expect(pythonDefinition.listExternalAnalyzerIds(allTools)).toEqual(["ast-grep", "ruff"]);
  });

  test("keeps pack-specific external analyzer policy on each definition", () => {
    const jsDefinition = getBuiltinPackDefinition("js-ts");
    const pythonDefinition = getBuiltinPackDefinition("python");
    const rustDefinition = getBuiltinPackDefinition("rust");
    const goDefinition = getBuiltinPackDefinition("go");
    const rubyDefinition = getBuiltinPackDefinition("ruby");

    expect(jsDefinition.listExternalAnalyzerIds(allTools)).toEqual(["knip", "ast-grep", "tsc", "eslint", "biome", "oxlint"]);
    expect(jsDefinition.listExternalAnalyzerIds(allTools, { withMadge: true })).toEqual(["knip", "madge", "ast-grep", "tsc", "eslint", "biome", "oxlint"]);
    expect(jsDefinition.listExternalAnalyzerIds(allTools, { category: "dead-code" })).toEqual(["knip", "ast-grep"]);
    expect(jsDefinition.listExternalAnalyzerIds(allTools, { category: "circular-deps" })).toEqual(["madge"]);
    expect(jsDefinition.listExternalAnalyzerIds(allTools, { partial: true })).toEqual([]);

    expect(pythonDefinition.listExternalAnalyzerIds(allTools)).toEqual(["ast-grep", "ruff"]);
    expect(rustDefinition.listExternalAnalyzerIds(allTools)).toEqual(["ast-grep", "cargo-clippy"]);
    expect(goDefinition.listExternalAnalyzerIds(allTools)).toEqual(["staticcheck", "golangci-lint"]);
    expect(rubyDefinition.listExternalAnalyzerIds(allTools)).toEqual(["rubocop"]);
  });
});

import { describe, expect, test } from "bun:test";
import { getBuiltinPackDefinition, listBuiltinPackDefinitions } from "./pack-registry";
import type { FileEntry, } from "./analyzers/file-walker";

function entry(path: string, content: string): FileEntry {
  return { path, content, lines: content.split("\n") };
}

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
    expect(jsDefinition.listExternalAnalyzerIds({ knip: true, madge: true, "ast-grep": true, tsc: true, eslint: true, biome: true, oxlint: true, ruff: true, "cargo-clippy": true, staticcheck: true, "golangci-lint": true, rubocop: true })).toEqual(["knip", "ast-grep", "tsc", "eslint", "biome", "oxlint"]);
    expect(pythonDefinition.listExternalAnalyzerIds({ knip: true, madge: true, "ast-grep": true, tsc: true, eslint: true, biome: true, oxlint: true, ruff: true, "cargo-clippy": true, staticcheck: true, "golangci-lint": true, rubocop: true })).toEqual(["ast-grep", "ruff"]);
  });
});

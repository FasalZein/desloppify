import { describe, expect, test } from "bun:test";
import type { FileEntry } from "./analyzers/file-walker";
import { getPackMeta, isRuleInPack, resolvePackSelection, runPackInternalAnalyzers } from "./packs";

function entry(path: string, content: string): FileEntry {
  return { path, content, lines: content.split("\n") };
}

describe("packs", () => {
  test("defaults to js-ts pack", () => {
    const pack = resolvePackSelection();

    expect(pack).toEqual({ name: "js-ts", explicit: false });
    expect(getPackMeta(pack.name).description).toContain("JavaScript");
  });

  test("accepts python, rust, go, and ruby as first-class packs", () => {
    const pythonPack = resolvePackSelection("python");
    const rustPack = resolvePackSelection("rust");
    const goPack = resolvePackSelection("go");
    const rubyPack = resolvePackSelection("ruby");

    expect(pythonPack).toEqual({ name: "python", explicit: true });
    expect(getPackMeta(pythonPack.name).description).toContain("Python");
    expect(rustPack).toEqual({ name: "rust", explicit: true });
    expect(getPackMeta(rustPack.name).description).toContain("Rust");
    expect(goPack).toEqual({ name: "go", explicit: true });
    expect(getPackMeta(goPack.name).description).toContain("Go");
    expect(rubyPack).toEqual({ name: "ruby", explicit: true });
    expect(getPackMeta(rubyPack.name).description).toContain("Ruby");
  });

  test("rejects unknown packs", () => {
    expect(() => resolvePackSelection("java")).toThrow("Unknown pack: java");
  });

  test("excludes noisy dead-variable ast-grep from the js-ts pack", () => {
    expect(isRuleInPack("js-ts", "DEAD_VARIABLE")).toBe(false);
    expect(isRuleInPack("js-ts", "CONSOLE_LOG")).toBe(true);
    expect(isRuleInPack("rust", "UNWRAP_CALL")).toBe(true);
    expect(isRuleInPack("rust", "USEEFFECT_ASYNC")).toBe(false);
    expect(isRuleInPack("go", "PANIC_CALL_GO")).toBe(true);
    expect(isRuleInPack("ruby", "RUBY_PUTS_DEBUG")).toBe(true);
  });

  test("scopes python, go, ruby, and js-ts internal analyzers to their own files and rules", () => {
    const entries = [
      entry("/repo/app.py", "# ====================\ndef run(items=[]):\n  return items\nlist = []\nyaml.load(payload)\nsubprocess.run(cmd, shell=True)"),
      entry("/repo/view.tsx", "useEffect(async () => { await load(); }, []);"),
      entry("/repo/main.go", "package main\nfunc run(err error) {\n  panic(err)\n  if err.Error() == \"boom\" {\n    return\n  }\n}\n"),
      entry("/repo/main.rb", "puts 'debug'\nbegin\n  work\nrescue\n  nil\nend\n"),
    ];

    const pythonIssues = runPackInternalAnalyzers("python", entries);
    const jsIssues = runPackInternalAnalyzers("js-ts", entries);
    const goIssues = runPackInternalAnalyzers("go", entries);
    const rubyIssues = runPackInternalAnalyzers("ruby", entries);

    expect(pythonIssues.map((issue) => issue.id)).toEqual(expect.arrayContaining([
      "BANNER_COMMENT",
      "MUTABLE_DEFAULT",
      "BUILTIN_SHADOW",
      "UNSAFE_YAML_LOAD",
      "SUBPROCESS_SHELL_TRUE",
    ]));
    expect(pythonIssues.every((issue) => issue.file.endsWith(".py"))).toBe(true);
    expect(pythonIssues.map((issue) => issue.id)).not.toContain("USEEFFECT_ASYNC");

    expect(goIssues.map((issue) => issue.id)).toEqual(expect.arrayContaining([
      "PANIC_CALL_GO",
      "ERROR_STRING_COMPARE_GO",
    ]));
    expect(goIssues.every((issue) => issue.file.endsWith(".go"))).toBe(true);

    expect(rubyIssues.map((issue) => issue.id)).toEqual(expect.arrayContaining([
      "RUBY_PUTS_DEBUG",
      "RUBY_BARE_RESCUE",
    ]));
    expect(rubyIssues.every((issue) => issue.file.endsWith(".rb"))).toBe(true);

    expect(jsIssues.map((issue) => issue.id)).toContain("USEEFFECT_ASYNC");
    expect(jsIssues.map((issue) => issue.id)).not.toContain("MUTABLE_DEFAULT");
  });
});

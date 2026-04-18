import { describe, expect, test } from "bun:test";
import type { FileEntry } from "./analyzers/file-walker";
import { getPackMeta, resolvePackSelection, runPackInternalAnalyzers } from "./packs";

function entry(path: string, content: string): FileEntry {
  return { path, content, lines: content.split("\n") };
}

describe("packs", () => {
  test("defaults to js-ts pack", () => {
    const pack = resolvePackSelection();

    expect(pack).toEqual({ name: "js-ts", explicit: false });
    expect(getPackMeta(pack.name).description).toContain("JavaScript");
  });

  test("accepts python as a first-class pack", () => {
    const pack = resolvePackSelection("python");

    expect(pack).toEqual({ name: "python", explicit: true });
    expect(getPackMeta(pack.name).description).toContain("Python");
  });

  test("rejects unknown packs", () => {
    expect(() => resolvePackSelection("ruby")).toThrow("Unknown pack: ruby");
  });

  test("scopes python and js-ts internal analyzers to their own files and rules", () => {
    const entries = [
      entry("/repo/app.py", "# ====================\ndef run(items=[]):\n  return items\nlist = []"),
      entry("/repo/view.tsx", "useEffect(async () => { await load(); }, []);"),
    ];

    const pythonIssues = runPackInternalAnalyzers("python", entries);
    const jsIssues = runPackInternalAnalyzers("js-ts", entries);

    expect(pythonIssues.map((issue) => issue.id)).toEqual(expect.arrayContaining([
      "BANNER_COMMENT",
      "MUTABLE_DEFAULT",
      "BUILTIN_SHADOW",
    ]));
    expect(pythonIssues.every((issue) => issue.file.endsWith(".py"))).toBe(true);
    expect(pythonIssues.map((issue) => issue.id)).not.toContain("USEEFFECT_ASYNC");

    expect(jsIssues.map((issue) => issue.id)).toContain("USEEFFECT_ASYNC");
    expect(jsIssues.map((issue) => issue.id)).not.toContain("MUTABLE_DEFAULT");
  });
});

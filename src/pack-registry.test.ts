import { describe, expect, test } from "bun:test";
import { getBuiltinPackDefinition } from "./pack-registry";
import type { FileEntry, } from "./analyzers/file-walker";

function entry(path: string, content: string): FileEntry {
  return { path, content, lines: content.split("\n") };
}

describe("pack registry", () => {
  test("exposes built-in pack metadata", () => {
    expect(getBuiltinPackDefinition("js-ts").meta.description).toContain("JavaScript");
    expect(getBuiltinPackDefinition("python").meta.description).toContain("Python");
  });

  test("runs built-in pack internal analyzers through registry definitions", () => {
    const entries = [
      entry("/repo/app.py", "# ====================\ndef run(items=[]):\n  return items\nlist = []"),
      entry("/repo/view.tsx", "useEffect(async () => { await load(); }, []);"),
    ];

    const pythonIssues = getBuiltinPackDefinition("python").runInternal(entries);
    const jsIssues = getBuiltinPackDefinition("js-ts").runInternal(entries);

    expect(pythonIssues.map((issue) => issue.id)).toEqual(expect.arrayContaining(["BANNER_COMMENT", "MUTABLE_DEFAULT", "BUILTIN_SHADOW"]));
    expect(jsIssues.map((issue) => issue.id)).toContain("USEEFFECT_ASYNC");
  });
});

import { describe, expect, test } from "bun:test";
import { runGrepExtendedFromEntries } from "./grep-extended";
import type { FileEntry } from "./file-walker";

function entry(path: string, content: string): FileEntry {
  return { path, content, lines: content.split("\n") };
}

describe("runGrepExtendedFromEntries", () => {
  test("detects async .then chains", () => {
    const issues = runGrepExtendedFromEntries([
      entry("/repo/src/main.ts", "promise.then(async () => { await work(); });"),
    ]);

    expect(issues.map((issue) => issue.id)).toContain("CALLBACK_PROMISE_MIX");
  });
});

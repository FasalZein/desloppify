import { describe, expect, test } from "bun:test";
import { runGrepPatternsFromEntries } from "./grep-patterns";
import { runGrepExtendedFromEntries } from "./grep-extended";
import type { FileEntry } from "./file-walker";

function entry(path: string, content: string): FileEntry {
  return { path, content, lines: content.split("\n") };
}

describe("self-scan rules", () => {
  test("COMMENTED_CODE_BLOCK ignores section headers", () => {
    const issues = runGrepPatternsFromEntries([
      entry("/repo/src/commands/rules.ts", "// async-correctness\nconst ok = true;"),
    ]);

    expect(issues.map((issue) => issue.id)).not.toContain("COMMENTED_CODE_BLOCK");
  });

  test("COMMENTED_CODE_BLOCK still catches commented-out async code", () => {
    const issues = runGrepPatternsFromEntries([
      entry("/repo/src/example.ts", "// async function loadUser() {\n//   return fetchUser();\n// }"),
    ]);

    expect(issues.map((issue) => issue.id)).toContain("COMMENTED_CODE_BLOCK");
  });

  test("CALLBACK_PROMISE_MIX ignores regex source lines", () => {
    const issues = runGrepExtendedFromEntries([
      entry("/repo/src/analyzers/grep-extended.ts", "pattern: /\\.then\\(\\s*(async|.*await)\\s/,"),
    ]);

    expect(issues.map((issue) => issue.id)).not.toContain("CALLBACK_PROMISE_MIX");
  });

  test("CALLBACK_PROMISE_MIX still catches async .then chains", () => {
    const issues = runGrepExtendedFromEntries([
      entry("/repo/src/example.ts", "promise.then(" + "async () => { await work(); });"),
    ]);

    expect(issues.map((issue) => issue.id)).toContain("CALLBACK_PROMISE_MIX");
  });
});

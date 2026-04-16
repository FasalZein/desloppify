import { describe, expect, test } from "bun:test";
import { runGrepPatternsFromEntries } from "./grep-patterns";
import type { FileEntry } from "./file-walker";

function entry(path: string, content: string): FileEntry {
  return { path, content, lines: content.split("\n") };
}

describe("runGrepPatternsFromEntries", () => {
  test("detects debug breakpoints", () => {
    const issues = runGrepPatternsFromEntries([
      entry("/repo/src/main.ts", "debugger;\nconst ok = true;"),
      entry("/repo/src/main.py", "breakpoint()\nprint('x')"),
      entry("/repo/src/lib.rs", "dbg!(value);"),
    ]);

    expect(issues.filter((issue) => issue.id === "DEBUG_BREAKPOINT")).toHaveLength(3);
  });

  test("detects log-and-rethrow across adjacent lines", () => {
    const issues = runGrepPatternsFromEntries([
      entry("/repo/src/main.ts", "console.error(error);\nthrow error;"),
    ]);

    expect(issues.map((issue) => issue.id)).toContain("LOG_AND_RETHROW");
  });

  test("detects unnecessary intermediate before return", () => {
    const issues = runGrepPatternsFromEntries([
      entry("/repo/src/main.ts", "const result = compute();\nreturn result;"),
    ]);

    expect(issues.map((issue) => issue.id)).toContain("UNNECESSARY_INTERMEDIATE");
  });

  test("detects unnecessary useCallback wrappers", () => {
    const issues = runGrepPatternsFromEntries([
      entry("/repo/src/main.tsx", "const onClick = use" + "Callback(() => submit(), []);"),
    ]);

    expect(issues.map((issue) => issue.id)).toContain("UNNECESSARY_USECALLBACK");
  });

  test("detects redundant boolean returns", () => {
    const issues = runGrepPatternsFromEntries([
      entry("/repo/src/main.ts", "if (ready) {\n  return true;\n}\nreturn false;"),
      entry("/repo/src/other.ts", "if (ready) return false; else return true;"),
    ]);

    expect(issues.filter((issue) => issue.id === "REDUNDANT_BOOLEAN_RETURN")).toHaveLength(2);
  });

  test("does not self-match metadata", () => {
    const issues = runGrepPatternsFromEntries([
      entry("/repo/src/analyzers/grep-patterns.ts", "pattern: /debugger|breakpoint|pdb\\.set_trace|dbg!/,"),
      entry("/repo/src/analyzers/grep-patterns.ts", "pattern: /useCallback\\(\\s*\\(\\)\\s*=>.*\\[\\s*\\]\\s*\\)/,"),
      entry("/repo/src/analyzers/grep-patterns.ts", "const IMPORT_RE = /(?:from\\s+[\"']x[\"']|require\\()/;"),
      entry("/repo/src/commands/rules.ts", 'desc: "debugger/breakpoint/pdb.set_trace/dbg! left in code"'),
      entry("/repo/src/ui.ts", 'DEBUG_BREAKPOINT: "Debug breakpoint left in code",'),
    ]);

    expect(issues.map((issue) => issue.id)).not.toContain("DEBUG_BREAKPOINT");
    expect(issues.map((issue) => issue.id)).not.toContain("UNNECESSARY_USECALLBACK");
    expect(issues.map((issue) => issue.id)).not.toContain("NESTED_TERNARY");
  });
});

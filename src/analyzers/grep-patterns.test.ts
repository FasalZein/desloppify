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
      entry("/repo/src/main.ts", "try {\n  work();\n} catch (error) {\n  console.error(error);\n  throw error;\n}"),
    ]);

    expect(issues.map((issue) => issue.id)).toContain("LOG_AND_RETHROW");
  });

  test("detects unnecessary intermediate before return", () => {
    const issues = runGrepPatternsFromEntries([
      entry("/repo/src/main.ts", "const result = compute();\nreturn result;"),
    ]);

    expect(issues.map((issue) => issue.id)).toContain("UNNECESSARY_INTERMEDIATE");
  });

  test("detects unnecessary memoization wrappers", () => {
    const issues = runGrepPatternsFromEntries([
      entry("/repo/src/main.tsx", "const onClick = use" + "Callback(() => submit(), []);"),
      entry("/repo/src/view.tsx", "const value = useMemo(() => expensive(), []);"),
    ]);

    expect(issues.map((issue) => issue.id)).toContain("UNNECESSARY_USECALLBACK");
    expect(issues.map((issue) => issue.id)).toContain("USEMEMO_EMPTY_DEPS");
  });

  test("detects redundant boolean returns", () => {
    const issues = runGrepPatternsFromEntries([
      entry("/repo/src/main.ts", "if (ready) {\n  return true;\n}\nreturn false;"),
      entry("/repo/src/other.ts", "if (ready) return false; else return true;"),
    ]);

    expect(issues.filter((issue) => issue.id === "REDUNDANT_BOOLEAN_RETURN")).toHaveLength(2);
  });

  test("avoids reviewed false positives", () => {
    const issues = runGrepPatternsFromEntries([
      entry("/repo/src/cache.ts", 'const cacheKey = `${options?.maxResults ?? "default"}:${options?.rerank ?? "default"}`;'),
      entry("/repo/src/frontmatter.ts", '...(prd?.prdId ? { parent_prd: prd.prdId } : {}),'),
      entry("/repo/src/summary.ts", 'return [title, scope ? `Scope: ${scope}` : null, target ? `Target: ${target}` : null];'),
      entry("/repo/src/template.ts", 'return `${priority ? ` | ${priority}` : ""}${tags.length ? ` | ${tags.join(" ")}` : ""}`;'),
      entry("/repo/src/cli.ts", 'console.log(`Started ${sliceId}`);'),
      entry("/repo/src/search.ts", 'let useBm25 = false;'),
      entry("/repo/src/find.ts", 'for (const line of lines) {\n  if (matches(line)) return true;\n}\nreturn false;'),
      entry("/repo/src/catch.ts", 'try {\n  run();\n} catch (error) {\n  console.error(error);\n  throw error;\n}'),
      entry("/repo/src/guard.ts", 'if (json) console.log(payload);\nthrow new Error("boom");'),
      entry("/repo/src/signature.ts", 'export function appendLogEntry(kind: string, title: string, options?: { project?: string; details?: string[] }) {\n  return title;\n}'),
      entry("/repo/src/conditional-type.ts", 'export type Handler<T> = T extends string ? (value: string) => void : T extends number ? (value: number) => void : never;'),
      entry("/repo/src/signature-conditional.ts", 'export function run<T>(value: T extends string ? string : number) {\n  return value;\n}'),
      entry("/repo/src/real.ts", 'const label = ready ? "done" : pending ? "later" : "never";'),
    ]);

    expect(issues.filter((issue) => issue.file !== "/repo/src/real.ts").map((issue) => issue.id)).not.toContain("NESTED_TERNARY");
    expect(issues.map((issue) => issue.id)).not.toContain("ENTRY_EXIT_LOG");
    expect(issues.map((issue) => issue.id)).not.toContain("NUMERIC_SUFFIX");
    expect(issues.map((issue) => issue.id)).not.toContain("REDUNDANT_BOOLEAN_RETURN");
    expect(issues.filter((issue) => issue.id === "LOG_AND_RETHROW")).toHaveLength(1);
    expect(issues.filter((issue) => issue.id === "NESTED_TERNARY")).toHaveLength(1);
  });

  test("detects hedging comments and fake loading delays", () => {
    const issues = runGrepPatternsFromEntries([
      entry("/repo/src/main.ts", "// this should be fine\nconst ok = true;"),
      entry("/repo/src/page.ts", "await new Promise((resolve) => setTimeout(resolve, 300));"),
    ]);

    expect(issues.map((issue) => issue.id)).toContain("HEDGING_COMMENT");
    expect(issues.map((issue) => issue.id)).toContain("FAKE_LOADING_DELAY");
  });

  test("detects representative rules from each smell family", () => {
    const issues = runGrepPatternsFromEntries([
      entry("/repo/src/slop.ts", "// placeholder\nconst ready = value === true;"),
      entry("/repo/src/legacy.ts", "// FIXME: remove after migration"),
      entry("/repo/src/defensive.ts", "const items = data?.items ?? [];"),
      entry("/repo/src/complexity.ts", "function run(first: boolean, second: boolean, third: boolean) {}"),
      entry("/repo/src/security.ts", 'const apiKey = "supersecret";'),
      entry("/repo/src/inconsistency.ts", 'const fs = require("node:fs");'),
    ]);

    expect(issues.map((issue) => issue.id)).toEqual(expect.arrayContaining([
      "DEMO_PLACEHOLDER",
      "EXPLICIT_TRUE_COMPARE",
      "TODO_REMOVE",
      "FIXME_HACK_XXX",
      "EMPTY_ARRAY_FALLBACK",
      "BOOLEAN_FLAG_PARAMS",
      "HARDCODED_SECRET",
      "MIXED_IMPORT_STYLE",
    ]));
  });

  test("detects model-style fallback anti-patterns", () => {
    const issues = runGrepPatternsFromEntries([
      entry("/repo/src/items.ts", "const items = data?.items ?? [];"),
      entry("/repo/src/options.ts", "const options = config?.options || {};"),
      entry("/repo/src/handler.ts", "const onError = props.onError || (() => {});"),
      entry("/repo/src/load.ts", "return Promise.resolve([]);"),
    ]);

    expect(issues.map((issue) => issue.id)).toEqual(expect.arrayContaining([
      "EMPTY_ARRAY_FALLBACK",
      "EMPTY_OBJECT_FALLBACK",
      "NOOP_LAMBDA_FALLBACK",
      "PROMISE_RESOLVE_FALLBACK",
    ]));
  });

  test("ignores decorative banner blocks but still flags lone separators", () => {
    const issues = runGrepPatternsFromEntries([
      entry("/repo/src/banners.ts", "// ====================\n// Streaming Handler\n// Handles SSE streaming\n// ===================="),
      entry("/repo/src/lone.ts", "// ====================\nconst value = 1;"),
    ]);

    expect(issues.filter((issue) => issue.id === "BANNER_COMMENT")).toHaveLength(1);
    expect(issues.find((issue) => issue.id === "BANNER_COMMENT")?.file).toBe("/repo/src/lone.ts");
  });

  test("supports pack-level rule filtering", () => {
    const issues = runGrepPatternsFromEntries([
      entry("/repo/src/main.ts", "// ====================\nconst ready = value === true;"),
    ], (ruleId) => ruleId === "BANNER_COMMENT");

    expect(issues.map((issue) => issue.id)).toEqual(["BANNER_COMMENT"]);
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

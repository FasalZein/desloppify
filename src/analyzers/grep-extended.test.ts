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

  test("detects researched slop gaps", () => {
    const issues = runGrepExtendedFromEntries([
      entry("/repo/src/main.ts", "return await fetchUser();"),
      entry("/repo/src/promise.ts", "return new Promise(async (resolve) => { resolve(await work()); });"), // desloppify:ignore ASYNC_PROMISE_EXECUTOR
      entry("/repo/src/clone.ts", "const copy = JSON.parse(JSON.stringify(config));"),
      entry("/repo/src/list.ts", "const rows = items.map(async (item) => save(item));"), // desloppify:ignore BARE_ASYNC_MAP
      entry("/repo/src/view.tsx", "useEffect(async () => { await load(); }, []);"),
    ]);

    expect(issues.map((issue) => issue.id)).toEqual(expect.arrayContaining([
      "REDUNDANT_RETURN_AWAIT",
      "ASYNC_PROMISE_EXECUTOR",
      "JSON_DEEP_CLONE",
      "BARE_ASYNC_MAP",
      "USEEFFECT_ASYNC",
    ]));
  });

  test("does not flag async map already wrapped in Promise.all", () => {
    const issues = runGrepExtendedFromEntries([
      entry("/repo/src/list.ts", "await Promise.all(items.map(async (item) => save(item)));"),
      entry("/repo/src/list-multiline.ts", "await Promise.all(\n  items.map(async (item) => save(item))\n);"),
      entry("/repo/src/list-assigned.ts", "const rows = items.map(async (item) => save(item));\nawait Promise.all(rows);"),
      entry("/repo/src/list-return.ts", "const rows = items.map(async (item) => save(item));\nreturn Promise.all(rows);"),
    ]);

    expect(issues.map((issue) => issue.id)).not.toContain("BARE_ASYNC_MAP");
  });

  test("supports pack-level rule filtering", () => {
    const issues = runGrepExtendedFromEntries([
      entry("/repo/src/data.py", "list = []\npickle.loads(payload)"),
    ], (ruleId) => ruleId === "PICKLE_LOADS");

    expect(issues.map((issue) => issue.id)).toEqual(["PICKLE_LOADS"]);
  });

  test("detects researched slop lexicon, JS/TS stubs, and dead feature flags", () => {
    const issues = runGrepExtendedFromEntries([
      entry("/repo/src/comments.ts", "// quick fix until the API is ready\nconst ok = true;"),
      entry("/repo/src/stub.ts", "export function render() {\n  throw new Error(\"Not implemented\");\n}"),
      entry("/repo/src/flags.ts", "const newCheckoutFeatureFlag = false;\nif (newCheckoutFeatureFlag) enableCheckout();"),
    ]);

    expect(issues.map((issue) => issue.id)).toEqual(expect.arrayContaining([
      "HANDWAVY_COMMENT",
      "NOT_IMPLEMENTED_STUB",
      "DEAD_FEATURE_FLAG",
    ]));
  });

  test("avoids reviewed runtime, naming, and stub false positives", () => {
    const issues = runGrepExtendedFromEntries([
      entry("/repo/src/fs.ts", "return Bun.file(path).json() as Promise<T>;"),
      entry("/repo/src/net.ts", "const response = await fetch(url);\nconst data = await response.json() as User;"),
      entry("/repo/src/search.ts", "let useBm25 = false;"),
      entry("/repo/src/math.ts", "const SM2 = { factor: 2 };\nconst sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);"),
      entry("/repo/src/__tests__/names.test.ts", "const id2 = makeId();"),
      entry("/repo/src/names.ts", "const handler2 = createHandler();"),
      entry("/repo/src/errors.ts", "throw new Error(\"boom\");"),
      entry("/repo/src/flags.ts", "const isPrimary = false;\nif (isPrimary) enablePrimary();"),
      entry("/repo/src/comments.ts", "// this should be fine\nconst ok = true;"),
    ]);

    expect(issues.filter((issue) => issue.id === "FETCH_RESPONSE_CAST")).toHaveLength(1);
    expect(issues.filter((issue) => issue.id === "NUMERIC_SUFFIX")).toHaveLength(1);
    expect(issues.map((issue) => issue.id)).not.toContain("NOT_IMPLEMENTED_STUB");
    expect(issues.map((issue) => issue.id)).not.toContain("DEAD_FEATURE_FLAG");
    expect(issues.map((issue) => issue.id)).not.toContain("HANDWAVY_COMMENT");
  });
});

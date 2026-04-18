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
    ]);

    expect(issues.map((issue) => issue.id)).not.toContain("BARE_ASYNC_MAP");
  });

  test("supports pack-level rule filtering", () => {
    const issues = runGrepExtendedFromEntries([
      entry("/repo/src/data.py", "list = []\npickle.loads(payload)"),
    ], (ruleId) => ruleId === "PICKLE_LOADS");

    expect(issues.map((issue) => issue.id)).toEqual(["PICKLE_LOADS"]);
  });

  test("avoids reviewed runtime and naming false positives", () => {
    const issues = runGrepExtendedFromEntries([
      entry("/repo/src/fs.ts", "return Bun.file(path).json() as Promise<T>;"),
      entry("/repo/src/net.ts", "const response = await fetch(url);\nconst data = await response.json() as User;"),
      entry("/repo/src/search.ts", "let useBm25 = false;"),
      entry("/repo/src/math.ts", "const SM2 = { factor: 2 };\nconst sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);"),
      entry("/repo/src/__tests__/names.test.ts", "const id2 = makeId();"),
      entry("/repo/src/names.ts", "const handler2 = createHandler();"),
    ]);

    expect(issues.filter((issue) => issue.id === "FETCH_RESPONSE_CAST")).toHaveLength(1);
    expect(issues.filter((issue) => issue.id === "NUMERIC_SUFFIX")).toHaveLength(1);
  });
});

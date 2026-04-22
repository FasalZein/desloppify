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

  test("detects cross-language security rules", () => {
    const issues = runGrepExtendedFromEntries([
      entry("/repo/src/view.tsx", "return <div dangerouslySetInnerHTML={{ __html: html }} />;"),
      entry("/repo/src/data.py", "yaml.load(payload)\nsubprocess.run(cmd, shell=True)"),
    ]);

    expect(issues.map((issue) => issue.id)).toEqual(expect.arrayContaining([
      "DANGEROUSLY_SET_INNER_HTML",
      "UNSAFE_YAML_LOAD",
      "SUBPROCESS_SHELL_TRUE",
    ]));
  });

  test("detects researched slop lexicon, JS/TS stubs, dead feature flags, and error semantics", () => {
    const issues = runGrepExtendedFromEntries([
      entry("/repo/src/comments.ts", "// quick fix until the API is ready\nconst ok = true;"),
      entry("/repo/src/stub.ts", "export function render() {\n  throw new Error(\"Not implemented\");\n}"),
      entry("/repo/src/flags.ts", "const newCheckoutFeatureFlag = false;\nif (newCheckoutFeatureFlag) enableCheckout();"),
      entry("/repo/src/throw-string.ts", "throw \"boom\";"),
      entry("/repo/src/throw-object.ts", "throw { code: \"E_BAD\" };"),
      entry("/repo/src/catch-wrap.ts", "try {\n  run();\n} catch (error) {\n  throw new Error(\"failed\");\n}"),
    ]);

    expect(issues.map((issue) => issue.id)).toEqual(expect.arrayContaining([
      "HANDWAVY_COMMENT",
      "NOT_IMPLEMENTED_STUB",
      "DEAD_FEATURE_FLAG",
      "THROW_NON_ERROR",
      "CATCH_WRAP_NO_CAUSE",
    ]));
  });

  test("avoids reviewed runtime, naming, stub, and exception false positives", () => {
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
      entry("/repo/src/catch-cause.ts", "try {\n  run();\n} catch (error) {\n  throw new Error(\"failed\", { cause: error });\n}"),
      entry("/repo/src/rethrow.ts", "try {\n  run();\n} catch (error) {\n  throw error;\n}"),
    ]);

    expect(issues.filter((issue) => issue.id === "FETCH_RESPONSE_CAST")).toHaveLength(1);
    expect(issues.filter((issue) => issue.id === "NUMERIC_SUFFIX")).toHaveLength(1);
    expect(issues.map((issue) => issue.id)).not.toContain("NOT_IMPLEMENTED_STUB");
    expect(issues.map((issue) => issue.id)).not.toContain("DEAD_FEATURE_FLAG");
    expect(issues.map((issue) => issue.id)).not.toContain("HANDWAVY_COMMENT");
    expect(issues.map((issue) => issue.id)).not.toContain("THROW_NON_ERROR");
    expect(issues.map((issue) => issue.id)).not.toContain("CATCH_WRAP_NO_CAUSE");
  });
});

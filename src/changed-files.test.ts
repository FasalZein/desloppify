import { describe, expect, test } from "bun:test";
import { parseGitFileList, pickDefaultBaseRef } from "./changed-files";

describe("parseGitFileList", () => {
  test("parses git diff output into absolute paths", () => {
    const files = parseGitFileList("src/a.ts\npackages/x/src/b.ts\n", "/repo");

    expect(files).toEqual([
      "/repo/src/a.ts",
      "/repo/packages/x/src/b.ts",
    ]);
  });
});

describe("pickDefaultBaseRef", () => {
  test("prefers origin head before local branches", () => {
    expect(pickDefaultBaseRef(["main", "origin/main", "origin/HEAD"])).toBe("origin/HEAD");
  });

  test("falls back to main/master variants", () => {
    expect(pickDefaultBaseRef(["feature", "main"])).toBe("main");
    expect(pickDefaultBaseRef(["feature", "origin/master"])).toBe("origin/master");
  });
});

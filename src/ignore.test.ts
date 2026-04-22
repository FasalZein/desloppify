import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runGrepExtendedFromEntries } from "./analyzers/grep-extended";
import { runGrepPatternsFromEntries } from "./analyzers/grep-patterns";
import { walkFiles } from "./analyzers/file-walker";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("ignore patterns", () => {
  test("walkFiles honors .desloppifyignore for self-scan noise paths", async () => {
    const root = mkdtempSync(join(tmpdir(), "desloppify-ignore-"));
    tempRoots.push(root);

    mkdirSync(join(root, "src", "analyzers"), { recursive: true });
    mkdirSync(join(root, "src"), { recursive: true });
    mkdirSync(join(root, "autoresearch-desloppify"), { recursive: true });
    writeFileSync(join(root, ".desloppifyignore"), "src/analyzers/*.test.ts\nautoresearch-desloppify/**\n", "utf8");
    writeFileSync(join(root, "src", "analyzers", "grep-patterns.test.ts"), "return undefined;\n", "utf8");
    writeFileSync(join(root, "autoresearch-desloppify", "dashboard.html"), "const view = a ? b : c ? d : e;\n", "utf8");
    writeFileSync(join(root, "src", "main.ts"), "return undefined;\n", "utf8");

    const entries = await walkFiles(root);

    expect(entries.map((entry) => entry.path)).toEqual([join(root, "src", "main.ts")]);
  });

  test("ignored self-scan fixtures do not leak pattern findings", async () => {
    const root = mkdtempSync(join(tmpdir(), "desloppify-ignore-"));
    tempRoots.push(root);

    mkdirSync(join(root, "src", "analyzers"), { recursive: true });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, ".desloppifyignore"), "src/analyzers/*.test.ts\n", "utf8");
    writeFileSync(join(root, "src", "analyzers", "grep-extended.test.ts"), "promise.then(async () => { await work(); });\n", "utf8");
    writeFileSync(join(root, "src", "main.ts"), "return undefined;\n", "utf8");

    const entries = await walkFiles(root);
    const issues = [
      ...runGrepPatternsFromEntries(entries),
      ...runGrepExtendedFromEntries(entries),
    ];

    expect(issues.map((issue) => issue.id)).toEqual(["RETURN_UNDEFINED"]);
  });
});

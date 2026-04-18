import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { runAstGrep } from "./ast-grep";

describe("runAstGrep", () => {
  test("supports pack-level rule and file filtering", async () => {
    const root = mkdtempSync(join(tmpdir(), "desloppify-ast-grep-"));
    writeFileSync(join(root, "main.ts"), 'console.log("x");\n');
    writeFileSync(join(root, "worker.py"), 'print("x")\n');

    const issues = await runAstGrep(root, {
      ruleFilter: (ruleId) => ruleId === "PRINT_STATEMENT",
      fileFilter: (filePath) => filePath.endsWith(".py"),
    });

    expect(issues.map((issue) => issue.id)).toEqual(["PRINT_STATEMENT"]);
    expect(issues[0]?.file.endsWith(".py")).toBe(true);
  });
});

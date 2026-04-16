import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { readFiles } from "./file-walker";

describe("readFiles", () => {
  test("reads unique files and skips missing ones", async () => {
    const root = mkdtempSync(join(tmpdir(), "desloppify-walker-"));
    mkdirSync(join(root, "src"));
    const file = join(root, "src", "a.ts");
    writeFileSync(file, "const a = 1;\n");

    const entries = await readFiles(root, [file, file, join(root, "missing.ts")]);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.path).toBe(file);
  });
});

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import command from "./fix";

let tempRoot: string | undefined;

afterEach(() => {
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = undefined;
});

const run = (args: string[]) => Bun.spawnSync(["bun", "src/cli.ts", "fix", ...args], {
  cwd: process.cwd(),
  stdout: "pipe",
  stderr: "pipe",
});

describe("fix command", () => {
  test("declares safety tier args", () => {
    expect(command.meta.name).toBe("fix");
    expect(command.args).toHaveProperty("safe");
    expect(command.args).toHaveProperty("confident");
    expect(command.args).toHaveProperty("all");
  });

  test("safe dry-run reports fixable issues without mutating files", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-fix-"));
    mkdirSync(join(tempRoot, "src"), { recursive: true });
    writeFileSync(join(tempRoot, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0" }));
    const filePath = join(tempRoot, "src", "bad.ts");
    writeFileSync(filePath, "// ====================\nconsole.log('debug');\n");

    const before = readFileSync(filePath, "utf8");
    const result = run([tempRoot, "--safe", "--dry-run"]);
    const after = readFileSync(filePath, "utf8");

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("BANNER_COMMENT");
    expect(before).toBe(after);
  });
});

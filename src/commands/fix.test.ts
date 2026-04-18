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
    writeFileSync(filePath, "// ====================\nconsole.log('debug');\nreturn undefined;\nconst ready = value === true;\n");

    const before = readFileSync(filePath, "utf8");
    const result = run([tempRoot, "--safe", "--dry-run"]);
    const after = readFileSync(filePath, "utf8");

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("BANNER_COMMENT");
    expect(result.stdout.toString()).toContain("RETURN_UNDEFINED");
    expect(result.stdout.toString()).toContain("EXPLICIT_TRUE_COMPARE");
    expect(before).toBe(after);
  });

  test("safe mode applies simple non-delete rewrites", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "desloppify-fix-apply-"));
    mkdirSync(join(tempRoot, "src"), { recursive: true });
    writeFileSync(join(tempRoot, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0" }));
    const filePath = join(tempRoot, "src", "bad.ts");
    writeFileSync(filePath, "return undefined;\nconst ready = value === true;\nconst closed = done === false;\n");

    const result = run([tempRoot, "--safe"]);
    const after = readFileSync(filePath, "utf8");

    expect(result.exitCode).toBe(0);
    expect(after).toContain("return;");
    expect(after).toContain("const ready = value;");
    expect(after).toContain("const closed = !done;");
  });
});

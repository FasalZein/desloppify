import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import command from "./install-hooks";

describe("install-hooks command", () => {
  test("declares print arg", () => {
    expect(command.args).toHaveProperty("print");
  });

  test("scaffolds repo-local hooks for the current git repo", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "desloppify-install-hooks-"));
    const init = spawnSync("git", ["init"], { cwd: repoRoot, encoding: "utf8" });
    expect(init.status).toBe(0);

    const result = spawnSync("bun", [join(process.cwd(), "src", "cli.ts"), "install-hooks"], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(existsSync(join(repoRoot, ".githooks", "pre-commit"))).toBe(true);
    expect(existsSync(join(repoRoot, ".githooks", "pre-push"))).toBe(true);
    expect(readFileSync(join(repoRoot, ".githooks", "pre-commit"), "utf8")).toContain("DESLOPPIFY_HOOK_SCOPE");

    const hooksPath = spawnSync("git", ["config", "--get", "core.hooksPath"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(hooksPath.status).toBe(0);
    expect(hooksPath.stdout.trim()).toBe(".githooks");
  });
});

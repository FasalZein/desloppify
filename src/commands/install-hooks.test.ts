import { describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import command from "./install-hooks";

describe("install-hooks command", () => {
  test("declares print arg", () => {
    expect(command.args).toHaveProperty("print");
  });

  test("scaffolds repo-local hooks that can run in the target repo", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "desloppify-install-hooks-"));
    const init = spawnSync("git", ["init"], { cwd: repoRoot, encoding: "utf8" });
    expect(init.status).toBe(0);

    writeFileSync(join(repoRoot, "package.json"), "{}\n");
    const add = spawnSync("git", ["add", "package.json"], { cwd: repoRoot, encoding: "utf8" });
    expect(add.status).toBe(0);

    const localBinDir = join(repoRoot, "node_modules", ".bin");
    mkdirSync(localBinDir, { recursive: true });
    const localCli = join(localBinDir, "desloppify");
    writeFileSync(localCli, `#!/bin/sh\nexec bun \"${join(process.cwd(), "src", "cli.ts")}\" \"$@\"\n`);
    chmodSync(localCli, 0o755);

    const result = spawnSync("bun", [join(process.cwd(), "src", "cli.ts"), "install-hooks"], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(existsSync(join(repoRoot, ".githooks", "pre-commit"))).toBe(true);
    expect(existsSync(join(repoRoot, ".githooks", "pre-push"))).toBe(true);
    expect(readFileSync(join(repoRoot, ".githooks", "pre-commit"), "utf8")).toContain("run_desloppify");

    const hooksPath = spawnSync("git", ["config", "--get", "core.hooksPath"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(hooksPath.status).toBe(0);
    expect(hooksPath.stdout.trim()).toBe(".githooks");

    const diffHook = spawnSync("sh", [join(repoRoot, ".githooks", "pre-commit")], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(diffHook.status).toBe(0);
    expect(diffHook.stdout).toContain("scanning staged changes");

    const repoHook = spawnSync("sh", [join(repoRoot, ".githooks", "pre-commit")], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, DESLOPPIFY_HOOK_SCOPE: "repo" },
    });
    expect(repoHook.status).toBe(0);
    expect(repoHook.stdout).toContain("scanning whole repo");
  });
});

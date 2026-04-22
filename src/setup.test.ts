import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatSetupGuide, getHooksInstallCommand, getSkillInstallCommand, installHooks } from "./setup";

describe("setup helpers", () => {
  test("builds the canonical skill install command", () => {
    expect(getSkillInstallCommand()).toEqual({
      command: "npx",
      args: ["skills", "add", "FasalZein/desloppify"],
      display: "npx skills add FasalZein/desloppify",
    });
  });

  test("builds the canonical hooks install command", () => {
    const install = getHooksInstallCommand();

    expect(install.command).toBe("sh");
    expect(install.args[0]).toBe("-c");
    expect(install.display).toContain("git rev-parse --show-toplevel");
    expect(install.display).toContain("current_hooks_path=$(git -C \"$repo_root\" config --worktree --get core.hooksPath 2>/dev/null || git -C \"$repo_root\" config --local --get core.hooksPath 2>/dev/null || true)");
    expect(install.display).toContain('write_hook "$repo_root/.githooks/pre-commit"');
    expect(install.display).toContain('write_hook "$repo_root/.githooks/pre-push"');
    expect(install.display).toContain("managed by desloppify install-hooks");
    expect(install.display).toContain("DESLOPPIFY_HOOK_SCOPE");
  });

  test("printed hook install script fails fast outside a git repo", () => {
    const outsideRepo = mkdtempSync(join(tmpdir(), "desloppify-hooks-no-git-"));
    const install = getHooksInstallCommand();
    const result = spawnSync("sh", ["-c", install.display], {
      cwd: outsideRepo,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("desloppify install-hooks must run inside a git repository");
    expect(existsSync(join(outsideRepo, ".githooks", "pre-commit"))).toBe(false);
  });

  test("printed hook install script targets the git root even from a subdirectory", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "desloppify-hooks-print-"));
    expect(spawnSync("git", ["init"], { cwd: repoRoot, encoding: "utf8" }).status).toBe(0);

    const subdir = join(repoRoot, "subdir");
    mkdirSync(subdir, { recursive: true });

    const install = getHooksInstallCommand();
    const result = spawnSync("sh", ["-c", install.display], {
      cwd: subdir,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(existsSync(join(repoRoot, ".githooks", "pre-commit"))).toBe(true);
    expect(existsSync(join(subdir, ".githooks", "pre-commit"))).toBe(false);
  });

  test("printed hook install script accepts trailing-slash default hooksPath", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "desloppify-hooks-print-default-trailing-"));
    expect(spawnSync("git", ["init"], { cwd: repoRoot, encoding: "utf8" }).status).toBe(0);
    expect(spawnSync("git", ["config", "core.hooksPath", ".git/hooks/"], { cwd: repoRoot, encoding: "utf8" }).status).toBe(0);

    const install = getHooksInstallCommand();
    const result = spawnSync("sh", ["-c", install.display], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(existsSync(join(repoRoot, ".githooks", "pre-commit"))).toBe(true);
  });

  test("printed hook install script matches runtime behavior for extra managed-directory hooks", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "desloppify-hooks-print-managed-"));
    expect(spawnSync("git", ["init"], { cwd: repoRoot, encoding: "utf8" }).status).toBe(0);
    expect(() => installHooks(repoRoot)).not.toThrow();

    const extraHook = join(repoRoot, ".githooks", "commit-msg");
    writeFileSync(extraHook, "#!/bin/sh\necho commit-msg\n");

    expect(() => installHooks(repoRoot)).not.toThrow();

    const install = getHooksInstallCommand();
    const result = spawnSync("sh", ["-c", install.display], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(readFileSync(extraHook, "utf8")).toContain("commit-msg");
  });

  test("installs repo-local hooks and configures git", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "desloppify-hooks-"));
    const init = spawnSync("git", ["init"], { cwd: repoRoot, encoding: "utf8" });
    expect(init.status).toBe(0);

    const result = installHooks(repoRoot);

    expect(result.repoRoot.endsWith(repoRoot)).toBe(true);
    expect(result.hooksDir).toBe(join(result.repoRoot, ".githooks"));
    expect(existsSync(join(repoRoot, ".githooks", "pre-commit"))).toBe(true);
    expect(existsSync(join(repoRoot, ".githooks", "pre-push"))).toBe(true);
    expect(readFileSync(join(repoRoot, ".githooks", "pre-commit"), "utf8")).toContain("managed by desloppify install-hooks");
    expect(readFileSync(join(repoRoot, ".githooks", "pre-push"), "utf8")).toContain("DESLOPPIFY_HOOK_SCOPE");

    const hooksPath = spawnSync("git", ["config", "--get", "core.hooksPath"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(hooksPath.status).toBe(0);
    expect(hooksPath.stdout.trim()).toBe(".githooks");
  });

  test("refuses to overwrite unmanaged hooks", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "desloppify-hooks-custom-"));
    expect(spawnSync("git", ["init"], { cwd: repoRoot, encoding: "utf8" }).status).toBe(0);
    mkdirSync(join(repoRoot, ".githooks"), { recursive: true });
    const hookPath = join(repoRoot, ".githooks", "pre-commit");
    writeFileSync(hookPath, "#!/bin/sh\necho custom hook\n");

    expect(() => installHooks(repoRoot)).toThrow("Refusing to overwrite existing unmanaged hook");
    expect(readFileSync(hookPath, "utf8")).toContain("custom hook");
  });

  test("accepts an absolute hooksPath that still points at .githooks", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "desloppify-hooks-absolute-"));
    expect(spawnSync("git", ["init"], { cwd: repoRoot, encoding: "utf8" }).status).toBe(0);
    expect(spawnSync("git", ["config", "core.hooksPath", join(repoRoot, ".githooks")], { cwd: repoRoot, encoding: "utf8" }).status).toBe(0);

    const result = installHooks(repoRoot);
    expect(result.hooksDir).toBe(join(result.repoRoot, ".githooks"));
    expect(existsSync(join(repoRoot, ".githooks", "pre-commit"))).toBe(true);
  });

  test("allows an explicit default .git/hooks path when no legacy hooks exist", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "desloppify-hooks-default-"));
    expect(spawnSync("git", ["init"], { cwd: repoRoot, encoding: "utf8" }).status).toBe(0);
    expect(spawnSync("git", ["config", "core.hooksPath", ".git/hooks"], { cwd: repoRoot, encoding: "utf8" }).status).toBe(0);

    const result = installHooks(repoRoot);
    expect(result.hooksDir).toBe(join(result.repoRoot, ".githooks"));
    expect(existsSync(join(repoRoot, ".githooks", "pre-commit"))).toBe(true);
  });

  test("refuses to disable legacy hooks in .git/hooks", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "desloppify-hooks-legacy-"));
    expect(spawnSync("git", ["init"], { cwd: repoRoot, encoding: "utf8" }).status).toBe(0);
    writeFileSync(join(repoRoot, ".git", "hooks", "pre-commit"), "#!/bin/sh\necho legacy hook\n");

    expect(() => installHooks(repoRoot)).toThrow("Refusing to disable existing hook");
    expect(existsSync(join(repoRoot, ".githooks", "pre-commit"))).toBe(false);
  });

  test("refuses to disable other legacy git hooks in .git/hooks", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "desloppify-hooks-legacy-other-"));
    expect(spawnSync("git", ["init"], { cwd: repoRoot, encoding: "utf8" }).status).toBe(0);
    writeFileSync(join(repoRoot, ".git", "hooks", "commit-msg"), "#!/bin/sh\necho commit-msg\n");

    expect(() => installHooks(repoRoot)).toThrow("Refusing to disable existing hook");
    expect(existsSync(join(repoRoot, ".githooks", "pre-commit"))).toBe(false);
  });

  test("ignores inherited global hooksPath when installing repo-local hooks", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "desloppify-hooks-global-"));
    const fakeHome = mkdtempSync(join(tmpdir(), "desloppify-hooks-home-"));
    expect(spawnSync("git", ["init"], { cwd: repoRoot, encoding: "utf8" }).status).toBe(0);
    expect(spawnSync("git", ["config", "--global", "core.hooksPath", "~/.global-hooks"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, HOME: fakeHome },
    }).status).toBe(0);

    const result = installHooks(repoRoot);
    expect(result.hooksDir).toBe(join(result.repoRoot, ".githooks"));
    expect(existsSync(join(repoRoot, ".githooks", "pre-commit"))).toBe(true);
  });

  test("refuses to replace another hooksPath manager", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "desloppify-hooks-path-"));
    expect(spawnSync("git", ["init"], { cwd: repoRoot, encoding: "utf8" }).status).toBe(0);
    expect(spawnSync("git", ["config", "core.hooksPath", ".husky"], { cwd: repoRoot, encoding: "utf8" }).status).toBe(0);

    expect(() => installHooks(repoRoot)).toThrow("Refusing to replace existing core.hooksPath=.husky");
    expect(existsSync(join(repoRoot, ".githooks", "pre-commit"))).toBe(false);
  });

  test("refuses to replace a worktree-scoped hooksPath manager", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "desloppify-hooks-worktree-"));
    expect(spawnSync("git", ["init"], { cwd: repoRoot, encoding: "utf8" }).status).toBe(0);
    expect(spawnSync("git", ["config", "extensions.worktreeConfig", "true"], { cwd: repoRoot, encoding: "utf8" }).status).toBe(0);
    expect(spawnSync("git", ["config", "--worktree", "core.hooksPath", ".husky"], { cwd: repoRoot, encoding: "utf8" }).status).toBe(0);

    expect(() => installHooks(repoRoot)).toThrow("Refusing to replace existing core.hooksPath=.husky");
    expect(existsSync(join(repoRoot, ".githooks", "pre-commit"))).toBe(false);
  });

  test("packages hook templates for bunx installs", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { files?: string[] };
    expect(pkg.files).toContain(".githooks/");
  });

  test("formats the onboarding guide", () => {
    const guide = formatSetupGuide();
    expect(guide).toContain("npx skills add FasalZein/desloppify");
    expect(guide).toContain("desloppify install-hooks");
    expect(guide).toContain("desloppify check-tools .");
    expect(guide).toContain("bunx desloppify scan . --pack <suggested-pack>");
    expect(guide).toContain("auto-adds .desloppify/ to .gitignore");
  });
});

import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
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
    expect(install.display).toContain("mkdir -p .githooks");
    expect(install.display).toContain("cat > .githooks/pre-commit");
    expect(install.display).toContain("cat > .githooks/pre-push");
    expect(install.display).toContain("git config core.hooksPath .githooks");
    expect(install.display).toContain("DESLOPPIFY_HOOK_SCOPE");
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
    expect(readFileSync(join(repoRoot, ".githooks", "pre-commit"), "utf8")).toContain("DESLOPPIFY_HOOK_SCOPE");
    expect(readFileSync(join(repoRoot, ".githooks", "pre-push"), "utf8")).toContain("DESLOPPIFY_HOOK_SCOPE");

    const hooksPath = spawnSync("git", ["config", "--get", "core.hooksPath"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(hooksPath.status).toBe(0);
    expect(hooksPath.stdout.trim()).toBe(".githooks");
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

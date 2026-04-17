import { describe, expect, test } from "bun:test";
import { formatSetupGuide, getHooksInstallCommand, getSkillInstallCommand } from "./setup";

describe("setup helpers", () => {
  test("builds the canonical skill install command", () => {
    expect(getSkillInstallCommand()).toEqual({
      command: "npx",
      args: ["skills", "add", "FasalZein/desloppify"],
      display: "npx skills add FasalZein/desloppify",
    });
  });

  test("builds the canonical hooks install command", () => {
    expect(getHooksInstallCommand()).toEqual({
      command: "git config core.hooksPath .githooks && chmod +x .githooks/pre-commit .githooks/pre-push",
      args: [],
      display: "git config core.hooksPath .githooks && chmod +x .githooks/pre-commit .githooks/pre-push",
    });
  });

  test("formats the onboarding guide", () => {
    const guide = formatSetupGuide();
    expect(guide).toContain("npx skills add FasalZein/desloppify");
    expect(guide).toContain("desloppify install-hooks");
    expect(guide).toContain("bunx desloppify scan . --pack js-ts");
  });
});

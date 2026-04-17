import { describe, expect, test } from "bun:test";
import { formatSetupGuide, getSkillInstallCommand } from "./setup";

describe("setup helpers", () => {
  test("builds the canonical skill install command", () => {
    expect(getSkillInstallCommand()).toEqual({
      command: "npx",
      args: ["skills", "add", "FasalZein/desloppify"],
      display: "npx skills add FasalZein/desloppify",
    });
  });

  test("formats the onboarding guide", () => {
    const guide = formatSetupGuide();
    expect(guide).toContain("npx skills add FasalZein/desloppify");
    expect(guide).toContain("bun run setup-hooks");
    expect(guide).toContain("bunx desloppify scan . --pack js-ts");
  });
});

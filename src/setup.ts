export const SKILL_INSTALL_COMMAND = ["npx", "skills", "add", "FasalZein/desloppify"] as const;

export function getSkillInstallCommand(): { command: string; args: string[]; display: string } {
  const [command, ...args] = SKILL_INSTALL_COMMAND;
  return {
    command,
    args: [...args],
    display: SKILL_INSTALL_COMMAND.join(" "),
  };
}

export function formatSetupGuide(): string {
  const install = getSkillInstallCommand().display;
  return [
    "1. Install the desloppify skill:",
    `   ${install}`,
    "",
    "2. Enable repo-local hooks (inside a repo clone):",
    "   bun run setup-hooks",
    "",
    "3. Run your first scan:",
    "   bunx desloppify scan . --pack js-ts",
    "",
    "Saved reports appear under .desloppify/reports/ after a normal scan.",
  ].join("\n");
}

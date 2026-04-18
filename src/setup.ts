export const SKILL_INSTALL_COMMAND = ["npx", "skills", "add", "FasalZein/desloppify"] as const;
export const HOOKS_INSTALL_COMMAND = ["git", "config", "core.hooksPath", ".githooks", "&&", "chmod", "+x", ".githooks/pre-commit", ".githooks/pre-push"] as const;

function formatCommand(parts: readonly string[]) {
  return parts.join(" ");
}

export function getSkillInstallCommand(): { command: string; args: string[]; display: string } {
  const [command, ...args] = SKILL_INSTALL_COMMAND;
  return {
    command,
    args: [...args],
    display: formatCommand(SKILL_INSTALL_COMMAND),
  };
}

export function getHooksInstallCommand(): { command: string; args: string[]; display: string } {
  return {
    command: formatCommand(HOOKS_INSTALL_COMMAND),
    args: [],
    display: formatCommand(HOOKS_INSTALL_COMMAND),
  };
}

export function formatSetupGuide(): string {
  const install = getSkillInstallCommand().display;
  return [
    "1. Install the desloppify skill:",
    `   ${install}`,
    "",
    "2. Enable repo-local hooks (inside a repo clone):",
    "   desloppify install-hooks",
    "",
    "3. Check detected tools and packs:",
    "   desloppify check-tools .",
    "",
    "4. Run your first scan with the suggested pack:",
    "   bunx desloppify scan . --pack js-ts",
    "",
    "Saved reports appear under .desloppify/reports/ after a normal scan.",
    "Current score and next-step hints are shown in the terminal summary.",
  ].join("\n");
}

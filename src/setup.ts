import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const SKILL_INSTALL_COMMAND = ["npx", "skills", "add", "FasalZein/desloppify"] as const;

function formatCommand(parts: readonly string[]) {
  return parts.join(" ");
}

function readHookTemplates() {
  return {
    preCommit: readFileSync(new URL("../.githooks/pre-commit", import.meta.url), "utf8"),
    prePush: readFileSync(new URL("../.githooks/pre-push", import.meta.url), "utf8"),
  };
}

function resolveGitRoot(cwd = process.cwd()): string {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    encoding: "utf8",
  });

  if ((result.status ?? 1) !== 0) {
    throw new Error("desloppify install-hooks must run inside a git repository");
  }

  return result.stdout.trim();
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
  const { preCommit, prePush } = readHookTemplates();
  const display = [
    "mkdir -p .githooks",
    "cat > .githooks/pre-commit <<'EOF'",
    preCommit.trimEnd(),
    "EOF",
    "cat > .githooks/pre-push <<'EOF'",
    prePush.trimEnd(),
    "EOF",
    "chmod +x .githooks/pre-commit .githooks/pre-push",
    "git config core.hooksPath .githooks",
  ].join("\n");

  return {
    command: "sh",
    args: ["-c", display],
    display,
  };
}

export function installHooks(cwd = process.cwd()): { repoRoot: string; hooksDir: string } {
  const repoRoot = resolveGitRoot(cwd);
  const hooksDir = join(repoRoot, ".githooks");
  const { preCommit, prePush } = readHookTemplates();

  mkdirSync(hooksDir, { recursive: true });
  writeFileSync(join(hooksDir, "pre-commit"), preCommit);
  writeFileSync(join(hooksDir, "pre-push"), prePush);
  chmodSync(join(hooksDir, "pre-commit"), 0o755);
  chmodSync(join(hooksDir, "pre-push"), 0o755);

  const result = spawnSync("git", ["config", "core.hooksPath", ".githooks"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if ((result.status ?? 1) !== 0) {
    throw new Error(result.stderr.trim() || "failed to configure core.hooksPath");
  }

  return { repoRoot, hooksDir };
}

export function formatSetupGuide(): string {
  const install = getSkillInstallCommand().display;
  return [
    "1. Install the desloppify skill:",
    `   ${install}`,
    "",
    "2. Enable repo-local hooks (inside a repo clone; scaffolds .githooks automatically):",
    "   desloppify install-hooks",
    "",
    "3. Check detected tools and packs:",
    "   desloppify check-tools .",
    "",
    "4. Run your first scan with the suggested pack:",
    "   bunx desloppify scan . --pack <suggested-pack>",
    "",
    "Saved reports appear under .desloppify/reports/ after a normal scan.",
    "The first artifact-writing scan auto-adds .desloppify/ to .gitignore in git repos.",
    "Current score and next-step hints are shown in the terminal summary.",
    "Set DESLOPPIFY_HOOK_SCOPE=repo if hook runs should scan the whole repo instead of just current changes.",
  ].join("\n");
}

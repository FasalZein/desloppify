import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve as resolvePath } from "node:path";
import { spawnSync } from "node:child_process";

const SKILL_INSTALL_COMMAND = ["npx", "skills", "add", "FasalZein/desloppify"] as const;

function formatCommand(parts: readonly string[]) {
  return parts.join(" ");
}

const MANAGED_HOOK_MARKER = "managed by desloppify install-hooks";

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

function normalizeHooksPath(repoRoot: string, hooksPath: string): string {
  if (hooksPath === ".githooks" || hooksPath === "./.githooks") {
    return join(realpathSync(repoRoot), ".githooks");
  }

  if (!hooksPath.startsWith("/")) {
    return resolvePath(realpathSync(repoRoot), hooksPath);
  }

  const parentDir = dirname(hooksPath);
  if (existsSync(parentDir)) {
    return join(realpathSync(parentDir), basename(hooksPath));
  }

  return hooksPath;
}

function isManagedHooksPath(repoRoot: string, hooksPath: string | null | undefined): boolean {
  if (!hooksPath) return false;
  return normalizeHooksPath(repoRoot, hooksPath) === join(realpathSync(repoRoot), ".githooks");
}

function isDefaultHooksPath(repoRoot: string, hooksPath: string | null | undefined): boolean {
  if (!hooksPath) return false;
  return normalizeHooksPath(repoRoot, hooksPath) === join(realpathSync(repoRoot), ".git", "hooks");
}

function readCurrentHooksPath(repoRoot: string): string | null {
  const result = spawnSync("git", ["config", "--local", "--get", "core.hooksPath"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if ((result.status ?? 1) !== 0) return null;
  return result.stdout.trim() || null;
}

function assertNoActiveLegacyHooks(activeHooksDir: string) {
  for (const hookName of ["pre-commit", "pre-push"] as const) {
    const hookPath = join(activeHooksDir, hookName);
    if (!existsSync(hookPath)) continue;

    const currentContents = readFileSync(hookPath, "utf8");
    if (currentContents.includes(MANAGED_HOOK_MARKER)) continue;

    throw new Error(`Refusing to disable existing hook: ${hookPath}`);
  }
}

function assertHooksPathCanBeConfigured(repoRoot: string) {
  const currentHooksPath = readCurrentHooksPath(repoRoot);
  const managedHooksDir = join(realpathSync(repoRoot), ".githooks");
  const defaultHooksDir = join(realpathSync(repoRoot), ".git", "hooks");

  if (currentHooksPath) {
    if (isManagedHooksPath(repoRoot, currentHooksPath)) return;
    if (!isDefaultHooksPath(repoRoot, currentHooksPath)) {
      throw new Error(`Refusing to replace existing core.hooksPath=${currentHooksPath}`);
    }
  }

  const activeHooksDir = currentHooksPath ? defaultHooksDir : defaultHooksDir;
  if (activeHooksDir !== managedHooksDir) {
    assertNoActiveLegacyHooks(activeHooksDir);
  }
}

function assertHookCanBeWritten(hookPath: string, nextContents: string) {
  if (!existsSync(hookPath)) return;

  const currentContents = readFileSync(hookPath, "utf8");
  if (currentContents === nextContents) return;
  if (currentContents.includes(MANAGED_HOOK_MARKER)) return;

  throw new Error(`Refusing to overwrite existing unmanaged hook: ${hookPath}`);
}

function writeManagedHook(hookPath: string, contents: string) {
  assertHookCanBeWritten(hookPath, contents);
  writeFileSync(hookPath, contents);
  chmodSync(hookPath, 0o755);
}

export function getHooksInstallCommand(): { command: string; args: string[]; display: string } {
  const { preCommit, prePush } = readHookTemplates();
  const display = [
    'repo_root=$(git rev-parse --show-toplevel)',
    'current_hooks_path=$(git -C "$repo_root" config --local --get core.hooksPath || true)',
    'managed_hooks_path=$(cd "$repo_root" && pwd)/.githooks',
    'default_hooks_path=$(cd "$repo_root" && pwd)/.git/hooks',
    'if [ -n "$current_hooks_path" ] && [ "$current_hooks_path" != ".githooks" ] && [ "$current_hooks_path" != "./.githooks" ] && [ "$current_hooks_path" != ".git/hooks" ] && [ "$current_hooks_path" != "./.git/hooks" ] && [ "$current_hooks_path" != "$managed_hooks_path" ] && [ "$current_hooks_path" != "$default_hooks_path" ]; then',
    '  printf "%s\\n" "Refusing to replace existing core.hooksPath=$current_hooks_path" >&2',
    '  exit 1',
    'fi',
    'active_hooks_dir="$default_hooks_path"',
    'if [ "$current_hooks_path" = ".githooks" ] || [ "$current_hooks_path" = "./.githooks" ] || [ "$current_hooks_path" = "$managed_hooks_path" ]; then',
    '  active_hooks_dir="$managed_hooks_path"',
    'fi',
    'for hook_name in pre-commit pre-push; do',
    '  hook_path="$active_hooks_dir/$hook_name"',
    `  if [ -f "$hook_path" ] && ! grep -q '${MANAGED_HOOK_MARKER}' "$hook_path"; then`,
    '    printf "%s\\n" "Refusing to disable existing hook: $hook_path" >&2',
    '    exit 1',
    '  fi',
    'done',
    'mkdir -p "$repo_root/.githooks"',
    'write_hook() {',
    '  hook_path="$1"',
    `  if [ -f "$hook_path" ] && ! grep -q '${MANAGED_HOOK_MARKER}' "$hook_path"; then`,
    '    printf "%s\\n" "Refusing to overwrite existing unmanaged hook: $hook_path" >&2',
    '    exit 1',
    '  fi',
    '  cat > "$hook_path"',
    '  chmod +x "$hook_path"',
    '}',
    'write_hook "$repo_root/.githooks/pre-commit" <<\'EOF\'',
    preCommit.trimEnd(),
    'EOF',
    'write_hook "$repo_root/.githooks/pre-push" <<\'EOF\'',
    prePush.trimEnd(),
    'EOF',
    'git -C "$repo_root" config core.hooksPath .githooks',
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

  assertHooksPathCanBeConfigured(repoRoot);
  mkdirSync(hooksDir, { recursive: true });
  writeManagedHook(join(hooksDir, "pre-commit"), preCommit);
  writeManagedHook(join(hooksDir, "pre-push"), prePush);

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

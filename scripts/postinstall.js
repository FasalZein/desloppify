#!/usr/bin/env node
/**
 * Post-install: copy SKILL.md to ~/.claude/skills/desloppify/
 * so the agent skill is available immediately after npm install.
 */
import { mkdirSync, copyFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";

const skillDir = join(homedir(), ".claude", "skills", "desloppify");
const skillSrc = join(dirname(new URL(import.meta.url).pathname), "..", "skills", "desloppify", "SKILL.md");

try {
  if (!existsSync(skillSrc)) process.exit(0); // not in the right context

  mkdirSync(skillDir, { recursive: true });
  copyFileSync(skillSrc, join(skillDir, "SKILL.md"));

  // Only log if running interactively (not in CI)
  if (process.stdout.isTTY) {
    console.log(`\x1b[38;5;208m✓\x1b[0m Skill installed to ${skillDir}`);
    console.log(`  Restart your agent session to use /desloppify`);
  }
} catch {
  // Silently fail — skill install is optional
}

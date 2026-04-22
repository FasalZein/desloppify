import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Issue } from "../types";
import { resolveToolCommand } from "../tool-command";
import { asArray, asObject, getNumber, getString } from "./json-value";
import { getJsTsLintMeta } from "./lint-metadata";
import { externalDeltaIdentity, externalSuccess, externalWarning, type ExternalAnalyzerResult } from "./external-result";

const ESLINT_CONFIG_FILES = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".eslintrc.yml",
  ".eslintrc.yaml",
] as const;

export async function runEslint(targetPath: string): Promise<ExternalAnalyzerResult> {
  if (!ESLINT_CONFIG_FILES.some((file) => existsSync(join(targetPath, file)))) return externalSuccess([]);

  const result = Bun.spawnSync([resolveToolCommand(targetPath, "eslint"), ".", "-f", "json"], {
    cwd: targetPath,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120_000,
  });

  if (result.exitCode !== 0 && result.exitCode !== 1) {
    return externalWarning("eslint", `command exited with code ${result.exitCode ?? 1}`, result.stderr.toString());
  }

  const stdout = result.stdout.toString().trim();
  if (!stdout) {
    return result.exitCode === 1
      ? externalWarning("eslint", "reported issues but produced no JSON output", result.stderr.toString())
      : externalSuccess([]);
  }

  try {
    const parsed: unknown = JSON.parse(stdout);
    const issues = asArray(parsed).flatMap((entry) => {
      const file = asObject(entry);
      if (!file) return [];

      return asArray(file.messages).flatMap((messageEntry) => {
        const message = asObject(messageEntry);
        if (!message) return [];

        const ruleId = getString(message.ruleId) ?? "eslint/unknown";
        const meta = getJsTsLintMeta(ruleId);
        const text = getString(message.message) ?? ruleId;
        return [{
          id: `ESLINT_${ruleId.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}`,
          category: meta.category,
          severity: meta.severity,
          tier: meta.tier,
          file: getString(file.filePath) ?? "unknown",
          line: getNumber(message.line) ?? 0,
          column: getNumber(message.column),
          endLine: getNumber(message.endLine),
          endColumn: getNumber(message.endColumn),
          message: text,
          fix: meta.fix,
          tool: "eslint",
          deltaIdentity: externalDeltaIdentity(ruleId, text),
        } satisfies Issue];
      });
    });
    return externalSuccess(issues);
  } catch {
    return externalWarning("eslint", "failed to parse JSON output", result.stderr.toString());
  }
}

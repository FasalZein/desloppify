import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Issue } from "../types";
import { resolveToolCommand } from "../tool-command";
import { asArray, asObject, getNumber, getString } from "./json-value";
import { getJsTsLintMeta } from "./lint-metadata";
import { externalDeltaIdentity, externalSuccess, externalWarning, type ExternalAnalyzerResult } from "./external-result";

const OXLINT_CONFIG_FILES = [
  ".oxlintrc.json",
  ".oxlintrc.jsonc",
  "oxlint.json",
  "oxlint.jsonc",
] as const;

export async function runOxlint(targetPath: string): Promise<ExternalAnalyzerResult> {
  const hasConfig = OXLINT_CONFIG_FILES.some((file) => existsSync(join(targetPath, file)));
  const hasPackage = existsSync(join(targetPath, "package.json"));
  if (!hasConfig && !hasPackage) return externalSuccess([]);

  const result = Bun.spawnSync([resolveToolCommand(targetPath, "oxlint"), ".", "--format", "json"], {
    cwd: targetPath,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120_000,
  });

  if (result.exitCode !== 0 && result.exitCode !== 1) {
    return externalWarning("oxlint", `command exited with code ${result.exitCode ?? 1}`, result.stderr.toString());
  }

  const stdout = result.stdout.toString().trim();
  if (!stdout) {
    return result.exitCode === 1
      ? externalWarning("oxlint", "reported issues but produced no JSON output", result.stderr.toString())
      : externalSuccess([]);
  }

  try {
    const parsed: unknown = JSON.parse(stdout);
    const issues = asArray(parsed).flatMap((entry) => {
      const item = asObject(entry);
      if (!item) return [];

      const firstLabel = asObject(asArray(item.labels)[0]);
      const ruleId = getString(item.code) ?? "oxlint/unknown";
      const meta = getJsTsLintMeta(ruleId);
      const text = getString(item.message) ?? ruleId;
      return [{
        id: `OXLINT_${ruleId.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}`,
        category: meta.category,
        severity: meta.severity,
        tier: meta.tier,
        file: getString(item.filePath) ?? "unknown",
        line: getNumber(item.line) ?? getNumber(firstLabel?.line) ?? 0,
        column: getNumber(item.column) ?? getNumber(firstLabel?.column),
        endLine: getNumber(item.endLine) ?? getNumber(firstLabel?.endLine),
        endColumn: getNumber(item.endColumn) ?? getNumber(firstLabel?.endColumn),
        message: text,
        fix: meta.fix,
        tool: "oxlint",
        deltaIdentity: externalDeltaIdentity(ruleId, text),
      } satisfies Issue];
    });
    return externalSuccess(issues);
  } catch {
    return externalWarning("oxlint", "failed to parse JSON output", result.stderr.toString());
  }
}

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Issue } from "../types";
import { asArray, asObject, getNumber, getString } from "./json-value";
import { getPythonLintMeta } from "./lint-metadata";
import { externalDeltaIdentity, externalSuccess, externalWarning, type ExternalAnalyzerResult } from "./external-result";

const RUFF_CONFIG_FILES = ["ruff.toml", ".ruff.toml", "pyproject.toml"] as const;

export async function runRuff(targetPath: string): Promise<ExternalAnalyzerResult> {
  if (!RUFF_CONFIG_FILES.some((file) => existsSync(join(targetPath, file)))) return externalSuccess([]);

  const result = Bun.spawnSync(["ruff", "check", ".", "--output-format", "json"], {
    cwd: targetPath,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120_000,
  });

  if (result.exitCode !== 0 && result.exitCode !== 1) {
    return externalWarning("ruff", `command exited with code ${result.exitCode ?? 1}`, result.stderr.toString());
  }

  const stdout = result.stdout.toString().trim();
  if (!stdout) {
    return result.exitCode === 1
      ? externalWarning("ruff", "reported issues but produced no JSON output", result.stderr.toString())
      : externalSuccess([]);
  }

  try {
    const parsed: unknown = JSON.parse(stdout);
    const issues = asArray(parsed).flatMap((entry) => {
      const item = asObject(entry);
      if (!item) return [];

      const location = asObject(item.location);
      const endLocation = asObject(item.end_location);
      const fix = asObject(item.fix);
      const ruleId = getString(item.code) ?? "RUFF";
      const meta = getPythonLintMeta(ruleId);
      const text = getString(item.message) ?? ruleId;
      return [{
        id: `RUFF_${ruleId.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}`,
        category: meta.category,
        severity: meta.severity,
        tier: meta.tier,
        file: getString(item.filename) ?? "unknown",
        line: getNumber(location?.row) ?? 0,
        column: getNumber(location?.column),
        endLine: getNumber(endLocation?.row),
        endColumn: getNumber(endLocation?.column),
        message: text,
        fix: getString(fix?.message) ?? meta.fix,
        tool: "ruff",
        deltaIdentity: externalDeltaIdentity(ruleId, text),
      } satisfies Issue];
    });
    return externalSuccess(issues);
  } catch {
    return externalWarning("ruff", "failed to parse JSON output", result.stderr.toString());
  }
}

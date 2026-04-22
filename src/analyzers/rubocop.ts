import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Issue } from "../types";
import { asArray, asObject, getNumber, getString } from "./json-value";
import { getRubyLintMeta } from "./lint-metadata";
import { externalDeltaIdentity, externalSuccess, externalWarning, type ExternalAnalyzerResult } from "./external-result";

export async function runRubocop(targetPath: string): Promise<ExternalAnalyzerResult> {
  const hasConfig = [".rubocop.yml", ".rubocop_todo.yml"].some((file) => existsSync(join(targetPath, file)));
  const hasRubyProject = existsSync(join(targetPath, "Gemfile")) || existsSync(join(targetPath, ".ruby-version"));
  if (!hasConfig && !hasRubyProject) return externalSuccess([]);

  const result = Bun.spawnSync(["rubocop", "--format", "json"], {
    cwd: targetPath,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 180_000,
  });

  if (result.exitCode !== 0 && result.exitCode !== 1) {
    return externalWarning("rubocop", `command exited with code ${result.exitCode ?? 1}`, result.stderr.toString());
  }

  const stdout = result.stdout.toString().trim();
  if (!stdout) {
    return result.exitCode === 1
      ? externalWarning("rubocop", "reported issues but produced no JSON output", result.stderr.toString())
      : externalSuccess([]);
  }

  try {
    const parsed = asObject(JSON.parse(stdout));
    if (!parsed) return externalWarning("rubocop", "JSON output was not an object", result.stderr.toString());

    const issues = asArray(parsed.files).flatMap((entry) => {
      const file = asObject(entry);
      if (!file) return [];
      return asArray(file.offenses).flatMap((offenseEntry) => {
        const offense = asObject(offenseEntry);
        if (!offense) return [];
        const location = asObject(offense.location);
        const ruleId = getString(offense.cop_name) ?? "RuboCop/Unknown";
        const meta = getRubyLintMeta(ruleId);
        const text = getString(offense.message) ?? ruleId;
        return [{
          id: `RUBOCOP_${ruleId.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}`,
          category: meta.category,
          severity: meta.severity,
          tier: meta.tier,
          file: getString(file.path) ?? "unknown",
          line: getNumber(location?.start_line) ?? getNumber(location?.line) ?? 0,
          column: getNumber(location?.start_column) ?? getNumber(location?.column),
          endLine: getNumber(location?.last_line),
          endColumn: getNumber(location?.last_column),
          message: text,
          fix: meta.fix,
          tool: "rubocop",
          deltaIdentity: externalDeltaIdentity(ruleId, text),
        } satisfies Issue];
      });
    });
    return externalSuccess(issues);
  } catch {
    return externalWarning("rubocop", "failed to parse JSON output", result.stderr.toString());
  }
}

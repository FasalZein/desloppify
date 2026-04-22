import type { Issue } from "../types";
import { asArray, asObject, getNumber, getString } from "./json-value";
import { getGoLintMeta } from "./lint-metadata";
import { externalDeltaIdentity, externalSuccess, externalWarning, type ExternalAnalyzerResult } from "./external-result";

export async function runGolangciLint(targetPath: string): Promise<ExternalAnalyzerResult> {
  const result = Bun.spawnSync(["golangci-lint", "run", "--out-format", "json"], {
    cwd: targetPath,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 180_000,
  });

  if (result.exitCode !== 0 && result.exitCode !== 1) {
    return externalWarning("golangci-lint", `command exited with code ${result.exitCode ?? 1}`, result.stderr.toString());
  }

  const stdout = result.stdout.toString().trim();
  if (!stdout) {
    return result.exitCode === 1
      ? externalWarning("golangci-lint", "reported issues but produced no JSON output", result.stderr.toString())
      : externalSuccess([]);
  }

  try {
    const parsed = asObject(JSON.parse(stdout));
    if (!parsed) return externalWarning("golangci-lint", "JSON output was not an object", result.stderr.toString());

    const issues = asArray(parsed.Issues).flatMap((entry) => {
      const item = asObject(entry);
      if (!item) return [];

      const position = asObject(item.Pos);
      const ruleId = getString(item.FromLinter) ?? "GOLANGCI";
      const meta = getGoLintMeta(ruleId);
      const text = getString(item.Text) ?? ruleId;
      return [{
        id: `GOLANGCI_${ruleId.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}`,
        category: meta.category,
        severity: meta.severity,
        tier: meta.tier,
        file: getString(position?.Filename) ?? "unknown",
        line: getNumber(position?.Line) ?? 0,
        column: getNumber(position?.Column),
        message: text,
        fix: meta.fix,
        tool: "golangci-lint",
        deltaIdentity: externalDeltaIdentity(ruleId, text),
      } satisfies Issue];
    });
    return externalSuccess(issues);
  } catch {
    return externalWarning("golangci-lint", "failed to parse JSON output", result.stderr.toString());
  }
}

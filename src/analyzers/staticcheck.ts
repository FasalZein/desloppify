import type { Issue } from "../types";
import { asObject, getNumber, getString } from "./json-value";
import { getGoLintMeta } from "./lint-metadata";
import { externalDeltaIdentity, externalSuccess, externalWarning, type ExternalAnalyzerResult } from "./external-result";

export async function runStaticcheck(targetPath: string): Promise<ExternalAnalyzerResult> {
  const result = Bun.spawnSync(["staticcheck", "-f", "json", "./..."], {
    cwd: targetPath,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 180_000,
  });

  if (result.exitCode !== 0 && result.exitCode !== 1) {
    return externalWarning("staticcheck", `command exited with code ${result.exitCode ?? 1}`, result.stderr.toString());
  }

  const stdout = result.stdout.toString().trim();
  if (!stdout) {
    return result.exitCode === 1
      ? externalWarning("staticcheck", "reported issues but produced no JSON output", result.stderr.toString())
      : externalSuccess([]);
  }

  const issues: Issue[] = [];

  for (const line of stdout.split("\n")) {
    if (!line.trim().startsWith("{")) continue;

    try {
      const entry = asObject(JSON.parse(line));
      if (!entry) continue;
      const location = asObject(entry.location);
      const position = asObject(location?.position);
      const ruleId = getString(entry.code) ?? "STATICCHECK";
      const meta = getGoLintMeta(ruleId);
      const text = getString(entry.message) ?? ruleId;
      issues.push({
        id: `STATICCHECK_${ruleId.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}`,
        category: meta.category,
        severity: meta.severity,
        tier: meta.tier,
        file: getString(location?.file) ?? "unknown",
        line: getNumber(position?.line) ?? 0,
        column: getNumber(position?.column),
        message: text,
        fix: meta.fix,
        tool: "staticcheck",
        deltaIdentity: externalDeltaIdentity(ruleId, text),
      });
    } catch {
      // ignore malformed line noise
    }
  }

  return externalSuccess(issues);
}

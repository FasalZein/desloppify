import type { Issue } from "../types";
import { getRustLintMeta } from "./lint-metadata";
import { externalDeltaIdentity, externalSuccess, externalWarning, type ExternalAnalyzerResult } from "./external-result";

export async function runCargoClippy(targetPath: string): Promise<ExternalAnalyzerResult> {
  const result = Bun.spawnSync(["cargo", "clippy", "--message-format=json", "--quiet"], {
    cwd: targetPath,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 180_000,
  });

  if (result.exitCode !== 0 && result.exitCode !== 1) {
    return externalWarning("cargo-clippy", `command exited with code ${result.exitCode ?? 1}`, result.stderr.toString());
  }

  const stdout = result.stdout.toString().trim();
  if (!stdout) {
    return result.exitCode === 1
      ? externalWarning("cargo-clippy", "reported issues but produced no JSON output", result.stderr.toString())
      : externalSuccess([]);
  }

  const issues: Issue[] = [];

  for (const line of stdout.split("\n")) {
    if (!line.trim().startsWith("{")) continue;

    try {
      const event = JSON.parse(line) as {
        reason?: string;
        message?: {
          code?: { code?: string };
          message?: string;
          spans?: Array<{
            file_name?: string;
            line_start?: number;
            line_end?: number;
            column_start?: number;
            column_end?: number;
            is_primary?: boolean;
          }>;
        };
      };

      if (event.reason !== "compiler-message") continue;
      const code = event.message?.code?.code;
      if (!code?.startsWith("clippy::")) continue;

      const meta = getRustLintMeta(code);
      const span = event.message?.spans?.find((candidate) => candidate.is_primary) ?? event.message?.spans?.[0];
      const text = event.message?.message ?? code;
      issues.push({
        id: `CLIPPY_${code.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}`,
        category: meta.category,
        severity: meta.severity,
        tier: meta.tier,
        file: span?.file_name ?? "unknown",
        line: span?.line_start ?? 0,
        column: span?.column_start,
        endLine: span?.line_end,
        endColumn: span?.column_end,
        message: text,
        fix: meta.fix,
        tool: "cargo-clippy",
        deltaIdentity: externalDeltaIdentity(code, text),
      });
    } catch {
      // ignore non-json noise
    }
  }

  return externalSuccess(issues);
}

import { externalDeltaIdentity, externalSuccess, externalWarning, type ExternalAnalyzerResult } from "./external-result";
import type { Issue } from "../types";
import { resolveToolCommand } from "../tool-command";

const IMPLICIT_ANY_PATTERN = /^(.+)\((\d+),(\d+)\):\s*error (TS7\d+):\s*(.+)$/;

export function parseTscIssues(stdout: string): Issue[] {
  const issues: Issue[] = [];

  for (const line of stdout.split("\n")) {
    const implicitMatch = line.match(IMPLICIT_ANY_PATTERN);
    const file = implicitMatch?.[1];
    const rawLine = implicitMatch?.[2];
    const rawColumn = implicitMatch?.[3];
    const code = implicitMatch?.[4];
    const message = implicitMatch?.[5];
    if (!file || !rawLine || !rawColumn || !code || !message) continue;
    issues.push({
      id: "IMPLICIT_ANY",
      category: "weak-types",
      severity: "MEDIUM",
      tier: 3,
      file,
      line: parseInt(rawLine, 10),
      column: parseInt(rawColumn, 10),
      message,
      fix: "Add explicit type annotation",
      tool: "tsc",
      deltaIdentity: externalDeltaIdentity(code, message),
    });
  }

  return issues;
}

export async function runTsc(targetPath: string): Promise<ExternalAnalyzerResult> {
  const result = Bun.spawnSync(
    [resolveToolCommand(targetPath, "tsc"), "--noEmit", "--pretty", "false"],
    { cwd: targetPath, stdout: "pipe", stderr: "pipe", timeout: 120_000 }
  );

  if (result.exitCode === 0) return externalSuccess([]);

  const stdout = result.stdout.toString().trim();
  const stderr = result.stderr.toString();
  if (!stdout) {
    return externalWarning("tsc", `command exited with code ${result.exitCode ?? 1}`, stderr);
  }

  return externalSuccess(parseTscIssues(stdout));
}

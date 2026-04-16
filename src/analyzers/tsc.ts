import type { Issue } from "../types";

export async function runTsc(targetPath: string): Promise<Issue[]> {
  const result = Bun.spawnSync(
    ["tsc", "--noEmit", "--pretty", "false"],
    { cwd: targetPath, stdout: "pipe", stderr: "pipe", timeout: 120_000 }
  );

  // tsc exits 0 if no errors
  if (result.exitCode === 0) return [];

  const stdout = result.stdout.toString().trim();
  if (!stdout) return [];

  const issues: Issue[] = [];
  const implicitAnyPattern = /^(.+)\((\d+),\d+\):\s*error TS7\d+:\s*(.+)$/;
  const errorPattern = /^(.+)\((\d+),\d+\):\s*error (TS\d+):\s*(.+)$/;

  for (const line of stdout.split("\n")) {
    // Catch implicit any errors (TS7005, TS7006, TS7015, TS7031, etc.)
    const implicitMatch = line.match(implicitAnyPattern);
    if (implicitMatch) {
      issues.push({
        id: "IMPLICIT_ANY",
        category: "weak-types",
        severity: "MEDIUM",
        tier: 3,
        file: implicitMatch[1],
        line: parseInt(implicitMatch[2], 10),
        message: implicitMatch[3],
        fix: "Add explicit type annotation",
        tool: "tsc",
      });
      continue;
    }
  }

  return issues;
}

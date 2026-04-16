import type { Issue } from "../types";

export async function runMadge(targetPath: string): Promise<Issue[]> {
  const result = Bun.spawnSync(
    [
      "npx", "--yes", "madge",
      "--circular",
      "--extensions", "ts,tsx,js,jsx",
      "--json",
      targetPath,
    ],
    { stdout: "pipe", stderr: "pipe", timeout: 60_000 }
  );

  // madge exits 0 even with circulars when using --json
  const stdout = result.stdout.toString().trim();
  if (!stdout) return [];

  try {
    const cycles: string[][] = JSON.parse(stdout);
    const issues: Issue[] = [];

    for (const cycle of cycles) {
      if (!Array.isArray(cycle) || cycle.length === 0) continue;

      const cycleStr = cycle.join(" → ") + " → " + cycle[0];
      issues.push({
        id: "CIRCULAR_IMPORT",
        category: "circular-deps",
        severity: "HIGH",
        tier: 3,
        file: cycle[0],
        line: 0,
        message: `Circular dependency: ${cycleStr}`,
        fix: "Extract shared types or use dependency inversion",
        tool: "madge",
      });
    }

    return issues;
  } catch {
    return [];
  }
}

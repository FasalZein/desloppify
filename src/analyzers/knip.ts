import type { Issue } from "../types";

export async function runKnip(targetPath: string): Promise<Issue[]> {
  const result = Bun.spawnSync(
    ["npx", "--yes", "knip", "--reporter", "json", "--no-progress"],
    {
      cwd: targetPath,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120_000,
    }
  );

  if (result.exitCode !== 0 && result.exitCode !== 1) {
    return [];
  }

  const stdout = result.stdout.toString().trim();
  if (!stdout) return [];

  try {
    const data = JSON.parse(stdout);
    const issues: Issue[] = [];

    if (data.files) {
      for (const file of data.files) {
        issues.push({
          id: "DEAD_FILE",
          category: "dead-code",
          severity: "HIGH",
          tier: 3,
          file: typeof file === "string" ? file : file.name ?? file,
          line: 0,
          message: "Unused file — not imported anywhere",
          fix: "Remove the file",
          tool: "knip",
        });
      }
    }

    if (data.exports) {
      for (const [file, exports] of Object.entries(data.exports)) {
        for (const exp of exports as Array<{ name: string; line: number }>) {
          issues.push({
            id: "DEAD_EXPORT",
            category: "dead-code",
            severity: "HIGH",
            tier: 3,
            file,
            line: exp.line ?? 0,
            message: `Unused export: ${exp.name}`,
            fix: `Remove export '${exp.name}' — no importers found`,
            tool: "knip",
          });
        }
      }
    }

    if (data.dependencies) {
      for (const [pkg, info] of Object.entries(data.dependencies)) {
        issues.push({
          id: "DEAD_DEPENDENCY",
          category: "dead-code",
          severity: "MEDIUM",
          tier: 3,
          file: "package.json",
          line: 0,
          message: `Unused dependency: ${pkg}`,
          fix: `Remove '${pkg}' from dependencies`,
          tool: "knip",
        });
      }
    }

    if (data.unlisted) {
      for (const [file, deps] of Object.entries(data.unlisted)) {
        for (const dep of deps as string[]) {
          issues.push({
            id: "UNLISTED_DEPENDENCY",
            category: "inconsistency",
            severity: "MEDIUM",
            tier: 0,
            file,
            line: 0,
            message: `Unlisted dependency: ${dep}`,
            tool: "knip",
          });
        }
      }
    }

    return issues;
  } catch {
    return [];
  }
}

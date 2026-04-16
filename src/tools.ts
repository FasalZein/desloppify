import type { ToolStatus } from "./types";

function commandExists(cmd: string): boolean {
  const result = Bun.spawnSync(["which", cmd], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return result.exitCode === 0;
}

function npxAvailable(pkg: string): boolean {
  const result = Bun.spawnSync(["npx", "--yes", pkg, "--help"], {
    stdout: "pipe",
    stderr: "pipe",
    timeout: 15_000,
  });
  return result.exitCode === 0;
}

export function detectTools(): ToolStatus {
  return {
    knip: commandExists("knip") || npxAvailable("knip"),
    madge: commandExists("madge") || npxAvailable("madge"),
    "ast-grep": commandExists("sg") || commandExists("ast-grep"),
    tsc: commandExists("tsc"),
    eslint: commandExists("eslint"),
    biome: commandExists("biome"),
  };
}

export function printToolStatus(tools: ToolStatus): string {
  const lines = Object.entries(tools).map(
    ([name, available]) => `  ${name}: ${available ? "\u2713" : "\u2717"}`
  );
  return lines.join("\n");
}

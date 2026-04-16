import type { ToolStatus } from "./types";

function commandExists(cmd: string): boolean {
  const result = Bun.spawnSync(["which", cmd], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return result.exitCode === 0;
}

function localBinExists(cmd: string): boolean {
  // Check node_modules/.bin/ in CWD (common for project-local tools)
  try {
    const localPath = `${process.cwd()}/node_modules/.bin/${cmd}`;
    return Bun.spawnSync(["test", "-x", localPath], {
      stdout: "pipe",
      stderr: "pipe",
    }).exitCode === 0;
  } catch {
    return false;
  }
}

function toolAvailable(cmd: string): boolean {
  return commandExists(cmd) || localBinExists(cmd);
}

export function detectTools(): ToolStatus {
  return {
    knip: toolAvailable("knip"),
    madge: toolAvailable("madge"),
    "ast-grep": toolAvailable("sg") || toolAvailable("ast-grep"),
    tsc: toolAvailable("tsc"),
    eslint: toolAvailable("eslint"),
    biome: toolAvailable("biome"),
  };
}

export function printToolStatus(tools: ToolStatus): string {
  const lines = Object.entries(tools).map(
    ([name, available]) => `  ${name}: ${available ? "\u2713" : "\u2717"}`
  );
  return lines.join("\n");
}

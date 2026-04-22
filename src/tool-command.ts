import { existsSync } from "node:fs";
import { join } from "node:path";

export function resolveToolCommand(rootPath: string, command: string): string {
  const localPath = join(rootPath, "node_modules", ".bin", command);
  return existsSync(localPath) ? localPath : command;
}

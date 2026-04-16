import { Glob } from "bun";
import { loadIgnorePatterns, isFileIgnored } from "../ignore";

export interface FileEntry {
  path: string;
  content: string;
  lines: string[];
}

const SKIP_PATH = /node_modules|\.git\/|\/dist\/|\/build\/|\.min\.|\/coverage\/|\/out\/|\/env\/|\/vendor\/|\/\.next\/|\/public\/.*assets\//;

/**
 * Single-pass file walker shared by all grep analyzers + file-metrics.
 * Reads each file once, returns entries for downstream analysis.
 */
export async function walkFiles(targetPath: string): Promise<FileEntry[]> {
  const ignorePatterns = await loadIgnorePatterns(targetPath);
  // Union of all extensions needed by grep-patterns, grep-extended, and file-metrics
  const glob = new Glob("**/*.{ts,tsx,js,jsx,py,rs,go,java,kt,rb,swift,c,cpp,cs,html}");
  const entries: FileEntry[] = [];

  for await (const filePath of glob.scan({
    cwd: targetPath,
    absolute: true,
    dot: false,
  })) {
    if (SKIP_PATH.test(filePath)) continue;
    if (isFileIgnored(filePath, targetPath, ignorePatterns)) continue;

    try {
      const content = await Bun.file(filePath).text();
      entries.push({ path: filePath, content, lines: content.split("\n") });
    } catch {
      // Unreadable file, skip
    }
  }

  return entries;
}

import { Glob } from "bun";
import { loadIgnorePatterns, isFileIgnored } from "../ignore";

export interface FileEntry {
  path: string;
  content: string;
  lines: string[];
}

const SKIP_PATH = /node_modules|\.git\/|\/dist\/|\/build\/|\.min\.|\/coverage\/|\/out\/|\/env\/|\/vendor\/|\/\.next\/|\/public\/.*assets\//;

async function readEntry(filePath: string): Promise<FileEntry | undefined> {
  try {
    const content = await Bun.file(filePath).text();
    return { path: filePath, content, lines: content.split("\n") };
  } catch {
    return;
  }
}

export async function readFiles(targetPath: string, filePaths: string[]): Promise<FileEntry[]> {
  const ignorePatterns = await loadIgnorePatterns(targetPath);
  const uniquePaths = [...new Set(filePaths)];
  const entries: FileEntry[] = [];

  for (const filePath of uniquePaths) {
    if (SKIP_PATH.test(filePath)) continue;
    if (isFileIgnored(filePath, targetPath, ignorePatterns)) continue;
    const entry = await readEntry(filePath);
    if (entry) entries.push(entry);
  }

  return entries;
}

/**
 * Single-pass file walker shared by all grep analyzers + file-metrics.
 * Reads each file once, returns entries for downstream analysis.
 */
export async function walkFiles(targetPath: string): Promise<FileEntry[]> {
  const ignorePatterns = await loadIgnorePatterns(targetPath);
  const glob = new Glob("**/*.{ts,tsx,js,jsx,py,rs,go,java,kt,rb,swift,c,cpp,cs,html}");
  const entries: FileEntry[] = [];

  for await (const filePath of glob.scan({
    cwd: targetPath,
    absolute: true,
    dot: false,
  })) {
    if (SKIP_PATH.test(filePath)) continue;
    if (isFileIgnored(filePath, targetPath, ignorePatterns)) continue;
    const entry = await readEntry(filePath);
    if (entry) entries.push(entry);
  }

  return entries;
}

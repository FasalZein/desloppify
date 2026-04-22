import { dirname, resolve } from "path";
import { getArchitectureProfile, type ArchitectureProfileName } from "../architecture";
import type { Issue } from "../types";
import type { FileEntry } from "./file-walker";

interface ArchitectureProfileOptions {
  architecture?: ArchitectureProfileName;
}

interface ModuleInfo {
  module: string;
  subpath: string;
}

const IMPORT_RE = /(?:from\s+["']([^"']+)["']|import\s+["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\))/;
const BOUNDARY_IMPORT_RE = /(?:^|\/)(?:repositories?|models?|db|schema)(?:\/|$)/;

function parseImport(line: string): string | undefined {
  const match = line.match(IMPORT_RE);
  if (!match) return;
  return match[1] || match[2] || match[3];
}

function resolveImportPath(filePath: string, importPath: string): string {
  if (importPath.startsWith(".")) return resolve(dirname(filePath), importPath);
  if (importPath.startsWith("src/")) return `/virtual/${importPath}`;
  if (importPath.startsWith("@/")) return `/virtual/src/${importPath.slice(2)}`;
  return importPath;
}

function getModuleInfo(filePath: string): ModuleInfo | undefined {
  const packageMatch = filePath.match(/\/packages\/[^/]+\/src\/([^/]+)(?:\/(.*))?$/);
  if (packageMatch?.[1]) {
    return { module: packageMatch[1], subpath: packageMatch[2] ?? "" };
  }

  const srcModuleMatch = filePath.match(/\/src\/modules\/([^/]+)(?:\/(.*))?$/);
  if (srcModuleMatch?.[1]) {
    return { module: srcModuleMatch[1], subpath: srcModuleMatch[2] ?? "" };
  }

  const virtualSrcModuleMatch = filePath.match(/\/virtual\/src\/modules\/([^/]+)(?:\/(.*))?$/);
  if (virtualSrcModuleMatch?.[1]) {
    return { module: virtualSrcModuleMatch[1], subpath: virtualSrcModuleMatch[2] ?? "" };
  }

  return;
}

function isPrivateModuleImport(currentFile: string, importPath: string): boolean {
  const current = getModuleInfo(currentFile);
  const target = getModuleInfo(resolveImportPath(currentFile, importPath));
  if (!current || !target || current.module === target.module) return false;
  if (!target.subpath) return false;
  return !/^index(?:\.|$)/.test(target.subpath);
}

export function runArchitectureProfileFromEntries(entries: FileEntry[], options: ArchitectureProfileOptions = {}): Issue[] {
  const profile = getArchitectureProfile(options.architecture);
  if (!profile?.name || profile.name !== "modular-monolith") return [];

  const issues: Issue[] = [];

  for (const entry of entries) {
    const fileName = entry.path.split("/").pop() ?? "";
    const isRouteFile = /\/routes\//.test(entry.path);
    const isRouteRegistrarIndex = profile.allowRouteRegistrarIndex && isRouteFile && fileName === "index.ts";

    for (let i = 0; i < entry.lines.length; i++) {
      const line = entry.lines[i] ?? "";
      const importPath = parseImport(line);
      if (!importPath) continue;

      if (isRouteFile && !isRouteRegistrarIndex && BOUNDARY_IMPORT_RE.test(importPath)) {
        issues.push({
          id: "LAYER_BOUNDARY_VIOLATION",
          category: "complexity",
          severity: "HIGH",
          tier: 0,
          file: entry.path,
          line: i + 1,
          message: "Route handler imports repository/model/db internals — go through service/public module API",
          tool: "architecture-profile",
        });
      }

      if (isPrivateModuleImport(entry.path, importPath)) {
        issues.push({
          id: "PRIVATE_MODULE_IMPORT",
          category: "inconsistency",
          severity: "MEDIUM",
          tier: 0,
          file: entry.path,
          line: i + 1,
          message: "Cross-module import bypasses target module public API — import from its curated index instead",
          tool: "architecture-profile",
        });
      }
    }
  }

  return issues;
}

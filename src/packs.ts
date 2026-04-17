import type { FileEntry } from "./analyzers/file-walker";
import { runArchitectureProfileFromEntries } from "./analyzers/architecture-profile";
import { runAstGrep } from "./analyzers/ast-grep";
import { runFileMetricsFromEntries } from "./analyzers/file-metrics";
import { runGrepExtendedFromEntries } from "./analyzers/grep-extended";
import { runGrepPatternsFromEntries } from "./analyzers/grep-patterns";
import { runKnip } from "./analyzers/knip";
import { runMadge } from "./analyzers/madge";
import { runTsc } from "./analyzers/tsc";
import type { Issue, PackName, PackSelection, ToolStatus } from "./types";

export interface PackMeta {
  name: PackName;
  description: string;
}

export interface PackRunOptions {
  architecture?: string;
  category?: string;
  partial?: boolean;
}

export interface PackExternalTask {
  name: string;
  promise: Promise<Issue[]>;
}

const PACKS: Record<PackName, PackMeta> = {
  "js-ts": {
    name: "js-ts",
    description: "JavaScript / TypeScript / React heuristics and tool adapters",
  },
};

export function isPackName(value: string): value is PackName {
  return value in PACKS;
}

export function resolvePackSelection(value?: string): PackSelection {
  if (!value) return { name: "js-ts", explicit: false };
  if (!isPackName(value)) throw new Error(`Unknown pack: ${value}`);
  return { name: value, explicit: true };
}

export function getPackMeta(pack: PackName): PackMeta {
  return PACKS[pack];
}

export function runPackInternalAnalyzers(pack: PackName, entries: FileEntry[], options: PackRunOptions = {}): Issue[] {
  switch (pack) {
    case "js-ts":
      return [
        ...runGrepPatternsFromEntries(entries),
        ...runGrepExtendedFromEntries(entries),
        ...runFileMetricsFromEntries(entries, { architecture: options.architecture }),
        ...runArchitectureProfileFromEntries(entries, { architecture: options.architecture }),
      ];
  }
}

export function getPackExternalTasks(
  pack: PackName,
  targetPath: string,
  tools: ToolStatus,
  options: PackRunOptions = {},
): PackExternalTask[] {
  const tasks: PackExternalTask[] = [];
  if (options.partial) return tasks;

  switch (pack) {
    case "js-ts": {
      if (tools.knip && (!options.category || options.category === "dead-code")) {
        tasks.push({ name: "knip", promise: runKnip(targetPath) });
      }
      if (tools.madge && (!options.category || options.category === "circular-deps")) {
        tasks.push({ name: "madge", promise: runMadge(targetPath) });
      }
      if (tools["ast-grep"]) {
        tasks.push({ name: "ast-grep", promise: runAstGrep(targetPath) });
      }
      if (tools.tsc && (!options.category || options.category === "weak-types")) {
        tasks.push({ name: "tsc", promise: runTsc(targetPath) });
      }
      return tasks;
    }
  }
}

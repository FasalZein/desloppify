import { runGrepExtendedFromEntries } from "./analyzers/grep-extended";
import { runGrepPatternsFromEntries } from "./analyzers/grep-patterns";
import type { FileEntry } from "./analyzers/file-walker";
import type { Issue } from "./types";

export type BuiltinTextAnalyzerId = "grep-patterns" | "grep-extended";

export interface BuiltinTextAnalyzerDefinition {
  id: BuiltinTextAnalyzerId;
  run: (entries: FileEntry[], ruleFilter?: (id: string) => boolean) => Issue[];
}

export const BUILTIN_TEXT_ANALYZERS: BuiltinTextAnalyzerDefinition[] = [
  { id: "grep-patterns", run: runGrepPatternsFromEntries },
  { id: "grep-extended", run: runGrepExtendedFromEntries },
];

export function runBuiltinTextAnalyzers(
  entries: FileEntry[],
  options: {
    ids?: BuiltinTextAnalyzerId[];
    ruleFilter?: (id: string) => boolean;
  } = {},
): Issue[] {
  const selected = options.ids ? new Set(options.ids) : null;

  return BUILTIN_TEXT_ANALYZERS
    .filter((analyzer) => !selected || selected.has(analyzer.id))
    .flatMap((analyzer) => analyzer.run(entries, options.ruleFilter));
}

import { runArchitectureProfileFromEntries } from "./analyzers/architecture-profile";
import { runFileMetricsFromEntries } from "./analyzers/file-metrics";
import { runGrepExtendedFromEntries } from "./analyzers/grep-extended";
import { runGrepPatternsFromEntries } from "./analyzers/grep-patterns";
import type { FileEntry } from "./analyzers/file-walker";
import type { ArchitectureProfileName } from "./architecture";
import type { Issue } from "./types";

type BuiltinTextAnalyzerId = "grep-patterns" | "grep-extended";
type BuiltinInternalAnalyzerId = BuiltinTextAnalyzerId | "file-metrics" | "architecture-profile";

interface BuiltinAnalyzerRunOptions {
  architecture?: ArchitectureProfileName;
  ruleFilter?: (id: string) => boolean;
}

interface BuiltinInternalAnalyzerDefinition {
  id: BuiltinInternalAnalyzerId;
  run: (entries: FileEntry[], options?: BuiltinAnalyzerRunOptions) => Issue[];
}

const BUILTIN_INTERNAL_ANALYZERS: BuiltinInternalAnalyzerDefinition[] = [
  { id: "grep-patterns", run: (entries, options) => runGrepPatternsFromEntries(entries, options?.ruleFilter) },
  { id: "grep-extended", run: (entries, options) => runGrepExtendedFromEntries(entries, options?.ruleFilter) },
  { id: "file-metrics", run: (entries, options) => runFileMetricsFromEntries(entries, { architecture: options?.architecture }) },
  { id: "architecture-profile", run: (entries, options) => runArchitectureProfileFromEntries(entries, { architecture: options?.architecture }) },
];

export function runBuiltinEntryAnalyzers(
  entries: FileEntry[],
  options: {
    ids?: BuiltinInternalAnalyzerId[];
    architecture?: ArchitectureProfileName;
    ruleFilter?: (id: string) => boolean;
  } = {},
): Issue[] {
  const selected = options.ids ? new Set(options.ids) : null;

  return BUILTIN_INTERNAL_ANALYZERS
    .filter((analyzer) => !selected || selected.has(analyzer.id))
    .flatMap((analyzer) => analyzer.run(entries, options));
}

export function runBuiltinTextAnalyzers(
  entries: FileEntry[],
  options: {
    ids?: BuiltinTextAnalyzerId[];
    ruleFilter?: (id: string) => boolean;
  } = {},
): Issue[] {
  return runBuiltinEntryAnalyzers(entries, options);
}

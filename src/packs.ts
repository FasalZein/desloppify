import type { FileEntry } from "./analyzers/file-walker";
import { PACK_NAMES } from "./domain/pack-catalog";
import { getBuiltinPackDefinition, type PackExternalTask, type PackMeta, type PackRunOptions } from "./pack-registry";
import type { Issue, PackName, PackSelection, ToolStatus } from "./types";

export { isRuleInPack } from "./pack-filters";

function isPackName(value: string): value is PackName {
  return PACK_NAMES.includes(value as PackName);
}

export function resolvePackSelection(value?: string): PackSelection {
  if (!value) return { name: "js-ts", explicit: false };
  if (!isPackName(value)) throw new Error(`Unknown pack: ${value}`);
  return { name: value, explicit: true };
}

export function getPackMeta(pack: PackName): PackMeta {
  return getBuiltinPackDefinition(pack).meta;
}

export function runPackInternalAnalyzers(pack: PackName, entries: FileEntry[], options: PackRunOptions = {}): Issue[] {
  return getBuiltinPackDefinition(pack).runInternal(entries, options);
}

export function getPackExternalTasks(
  pack: PackName,
  targetPath: string,
  tools: ToolStatus,
  options: PackRunOptions = {},
): PackExternalTask[] {
  return getBuiltinPackDefinition(pack).getExternalTasks(targetPath, tools, options);
}

import type { FileEntry } from "../analyzers/file-walker";
import type { ArchitectureProfileName } from "../architecture";
import type { BuiltinExternalAnalyzerId, BuiltinExternalTask, BuiltinExternalRunOptions } from "../external-analyzer-registry";
import type { Issue, PackName, ToolStatus } from "../types";
import type { PACK_CATALOG } from "./pack-catalog";

type PackCatalogEntry = (typeof PACK_CATALOG)[PackName];

export type PackMeta = PackCatalogEntry & {
  name: PackName;
};

export interface PackRunOptions extends BuiltinExternalRunOptions {
  architecture?: ArchitectureProfileName;
}

export interface PackDefinition {
  meta: PackMeta;
  runInternal: (entries: FileEntry[], options?: PackRunOptions) => Issue[];
  listExternalAnalyzerIds: (tools: ToolStatus, options?: BuiltinExternalRunOptions) => BuiltinExternalAnalyzerId[];
  getExternalTasks: (targetPath: string, tools: ToolStatus, options?: BuiltinExternalRunOptions) => BuiltinExternalTask[];
}

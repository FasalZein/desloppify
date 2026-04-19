import { defineCommand } from "citty";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compareScanReports, type DeltaStatus, type ScanDeltaReport } from "../scan-delta";
import type { Category, ScanReport } from "../types";

const DELTA_STATUSES: DeltaStatus[] = ["added", "resolved", "worsened", "improved"];

interface DeltaAnalyticsBucket {
  key: string;
  added: number;
  worsened: number;
  resolved: number;
  improved: number;
  regressionCount: number;
  improvementCount: number;
  netCount: number;
}

interface DeltaCommandJson extends ScanDeltaReport {
  basePath: string;
  headPath: string;
  scope: {
    category: Category | null;
    path: string | null;
  };
  categories: Array<DeltaAnalyticsBucket & { category: Category }>;
  paths: Array<DeltaAnalyticsBucket & { path: string }>;
}

interface DeltaScope {
  category?: Category;
  path?: string;
}

export default defineCommand({
  meta: { name: "delta", description: "Compare two saved scan reports and summarize regressions" },
  args: {
    base: { type: "positional", description: "Base repo path or saved findings.json path", default: "" },
    head: { type: "positional", description: "Head repo path or saved findings.json path", default: "" },
    "base-report": { type: "string", description: "Explicit base findings.json path" },
    "head-report": { type: "string", description: "Explicit head findings.json path" },
    json: { type: "boolean", description: "Machine-readable JSON output" },
    category: { type: "string", description: "Limit delta output to one category" },
    path: { type: "string", description: "Limit delta output to one path or glob" },
    "fail-on": { type: "string", description: "Comma-separated statuses: added,worsened,resolved,improved,any" },
  },
  run({ args }) {
    const baseReport = loadScanReport(resolveInput(args.base, args["base-report"], "base"));
    const headReport = loadScanReport(resolveInput(args.head, args["head-report"], "head"));
    const delta = compareScanReports(baseReport, headReport);
    const scope = parseScope(args.category, args.path);
    const scopedDelta = filterDelta(delta, scope);
    const failOn = parseFailOn(args["fail-on"]);

    const jsonReport = buildDeltaCommandJson(baseReport, headReport, scopedDelta, scope);

    if (args.json) {
      console.log(JSON.stringify(jsonReport, null, 2));
      process.exit(shouldFail(scopedDelta, failOn) ? 1 : 0);
    }

    console.log("# Desloppify delta");
    console.log(`Base: ${baseReport.scan.path}`);
    console.log(`Head: ${headReport.scan.path}`);
    if (scope.category || scope.path) {
      console.log(`Scope: ${formatScope(scope)}`);
    }
    console.log("");
    console.log(`- added: ${scopedDelta.summary.addedCount}`);
    console.log(`- resolved: ${scopedDelta.summary.resolvedCount}`);
    console.log(`- worsened: ${scopedDelta.summary.worsenedCount}`);
    console.log(`- improved: ${scopedDelta.summary.improvedCount}`);
    console.log(`- unchanged: ${scopedDelta.summary.unchangedCount}`);

    const notable = scopedDelta.changes.filter((change) => change.status !== "unchanged");
    if (jsonReport.categories.length > 0) {
      console.log("");
      console.log("## Categories");
      for (const bucket of jsonReport.categories.slice(0, 10)) {
        console.log(`- ${bucket.category}: +${bucket.added} added, +${bucket.worsened} worsened, -${bucket.resolved} resolved, -${bucket.improved} improved`);
      }
    }

    if (jsonReport.paths.length > 0) {
      console.log("");
      console.log("## Paths");
      for (const bucket of jsonReport.paths.slice(0, 10)) {
        console.log(`- ${bucket.path}: +${bucket.added} added, +${bucket.worsened} worsened, -${bucket.resolved} resolved, -${bucket.improved} improved`);
      }
    }

    if (notable.length > 0) {
      console.log("");
      console.log("## Changes");
      for (const change of notable.slice(0, 20)) {
        console.log(`- ${change.status.toUpperCase()} ${change.ruleId} ${describePath(change)}${describeMessage(change)}`);
      }
    }

    if (failOn.length > 0) {
      console.log("");
      console.log(`Fail on: ${failOn.join(",")}`);
    }

    process.exit(shouldFail(scopedDelta, failOn) ? 1 : 0);
  },
});

function resolveInput(positional: string | undefined, explicit: string | undefined, label: string): string {
  const candidate = explicit ?? positional;
  if (!candidate) throw new Error(`Missing ${label} input. Provide ${label} path or --${label}-report.`);

  const resolved = resolve(candidate);
  if (resolved.endsWith(".json")) return resolved;
  return join(resolved, ".desloppify", "reports", "latest.findings.json");
}

function loadScanReport(path: string): ScanReport {
  if (!existsSync(path)) throw new Error(`No saved findings report at ${path}`);
  return JSON.parse(readFileSync(path, "utf8")) as ScanReport;
}

function parseFailOn(input: string | undefined): DeltaStatus[] {
  if (!input) return [];
  const values = input.split(",").map((value) => value.trim()).filter(Boolean);
  if (values.includes("any")) return [...DELTA_STATUSES];
  for (const value of values) {
    if (!DELTA_STATUSES.includes(value as DeltaStatus)) {
      throw new Error(`Unknown fail-on status: ${value}`);
    }
  }
  return values as DeltaStatus[];
}

function parseScope(categoryInput: string | undefined, pathInput: string | undefined): DeltaScope {
  const scope: DeltaScope = {};

  if (categoryInput) {
    scope.category = categoryInput as Category;
  }

  if (pathInput) {
    scope.path = pathInput;
  }

  return scope;
}

function shouldFail(delta: ScanDeltaReport, failOn: DeltaStatus[]): boolean {
  if (failOn.length === 0) return false;
  return delta.changes.some((change) => failOn.includes(change.status));
}

function filterDelta(delta: ScanDeltaReport, scope: DeltaScope): ScanDeltaReport {
  if (!scope.category && !scope.path) return delta;

  const changes = delta.changes.filter((change) => matchesScope(change, scope));
  return {
    summary: buildSummary(changes),
    changes,
  };
}

function buildDeltaCommandJson(base: ScanReport, head: ScanReport, delta: ScanDeltaReport, scope: DeltaScope): DeltaCommandJson {
  return {
    basePath: base.scan.path,
    headPath: head.scan.path,
    scope: {
      category: scope.category ?? null,
      path: scope.path ?? null,
    },
    ...delta,
    categories: summarizeByCategory(delta),
    paths: summarizeByPath(delta),
  };
}

function summarizeByCategory(delta: ScanDeltaReport): Array<DeltaAnalyticsBucket & { category: Category }> {
  const buckets = new Map<Category, DeltaAnalyticsBucket & { category: Category }>();

  for (const change of delta.changes) {
    if (change.status === "unchanged") continue;
    const category = change.head?.category ?? change.base?.category;
    if (!category) continue;
    const bucket = buckets.get(category) ?? createBucket(category, { category });
    applyChange(bucket, change.status);
    buckets.set(category, bucket);
  }

  return sortBuckets([...buckets.values()]);
}

function summarizeByPath(delta: ScanDeltaReport): Array<DeltaAnalyticsBucket & { path: string }> {
  const buckets = new Map<string, DeltaAnalyticsBucket & { path: string }>();

  for (const change of delta.changes) {
    if (change.status === "unchanged") continue;
    const path = change.path ?? change.head?.locations[0]?.path ?? change.base?.locations[0]?.path;
    if (!path) continue;
    const bucket = buckets.get(path) ?? createBucket(path, { path });
    applyChange(bucket, change.status);
    buckets.set(path, bucket);
  }

  return sortBuckets([...buckets.values()]);
}

function matchesScope(change: ScanDeltaReport["changes"][number], scope: DeltaScope): boolean {
  if (scope.category) {
    const category = change.head?.category ?? change.base?.category;
    if (category !== scope.category) return false;
  }

  if (scope.path) {
    const path = change.path ?? change.head?.locations[0]?.path ?? change.base?.locations[0]?.path;
    if (!path || !matchesPathScope(path, scope.path)) return false;
  }

  return true;
}

function matchesPathScope(path: string, pattern: string): boolean {
  if (!pattern.includes("*")) return path.includes(pattern);
  const doubleStarToken = "__DESLOPPIFY_DOUBLE_STAR__";
  const escaped = escapeRegex(pattern)
    .replace(/\*\*/g, doubleStarToken)
    .replace(/\*/g, "[^/]*")
    .replaceAll(doubleStarToken, ".*");
  return new RegExp(`^${escaped}$`).test(path);
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function buildSummary(changes: ScanDeltaReport["changes"]): ScanDeltaReport["summary"] {
  return {
    baseFindingCount: changes.filter((change) => change.base).length,
    headFindingCount: changes.filter((change) => change.head).length,
    addedCount: changes.filter((change) => change.status === "added").length,
    resolvedCount: changes.filter((change) => change.status === "resolved").length,
    unchangedCount: changes.filter((change) => change.status === "unchanged").length,
    worsenedCount: changes.filter((change) => change.status === "worsened").length,
    improvedCount: changes.filter((change) => change.status === "improved").length,
    changed: changes.some((change) => change.status !== "unchanged"),
  };
}

function formatScope(scope: DeltaScope): string {
  return [
    scope.category ? `category=${scope.category}` : null,
    scope.path ? `path=${scope.path}` : null,
  ].filter(Boolean).join(", ");
}

function createBucket<T extends { key: string }>(key: string, extra: Omit<T, "key">): DeltaAnalyticsBucket & T {
  return {
    key,
    added: 0,
    worsened: 0,
    resolved: 0,
    improved: 0,
    regressionCount: 0,
    improvementCount: 0,
    netCount: 0,
    ...(extra as T),
  };
}

function applyChange(bucket: DeltaAnalyticsBucket, status: DeltaStatus): void {
  if (status === "unchanged") return;
  bucket[status] += 1;
  bucket.regressionCount = bucket.added + bucket.worsened;
  bucket.improvementCount = bucket.resolved + bucket.improved;
  bucket.netCount = bucket.regressionCount - bucket.improvementCount;
}

function sortBuckets<T extends DeltaAnalyticsBucket>(buckets: T[]): T[] {
  return buckets.sort((left, right) => (
    right.regressionCount - left.regressionCount ||
    right.worsened - left.worsened ||
    right.added - left.added ||
    left.improvementCount - right.improvementCount ||
    left.key.localeCompare(right.key)
  ));
}

function describePath(change: ScanDeltaReport["changes"][number]): string {
  return change.path ? `${change.path}` : "<unknown path>";
}

function describeMessage(change: ScanDeltaReport["changes"][number]): string {
  const message = change.head?.message ?? change.base?.message;
  return message ? ` — ${message}` : "";
}

import { describe, expect, test } from "bun:test";
import { runFileMetricsFromEntries } from "./file-metrics";
import type { FileEntry } from "./file-walker";

function entry(path: string, content: string): FileEntry {
  return { path, content, lines: content.split("\n") };
}

function locLines(count: number, prefix = "line") {
  return Array.from({ length: count }, (_, i) => `const ${prefix}${i} = ${i};`).join("\n");
}

describe("runFileMetricsFromEntries", () => {
  test("flags long files at the default soft limit", () => {
    const issues = runFileMetricsFromEntries([entry("/repo/src/large.ts", locLines(300))]);

    expect(issues.some((issue) => issue.id === "LONG_FILE")).toBe(true);
  });

  test("applies stricter route thresholds for modular-monolith", () => {
    const issues = runFileMetricsFromEntries([
      entry("/repo/apps/api/src/routes/documents/create.ts", locLines(150)),
    ], { architecture: "modular-monolith" });

    expect(issues.some((issue) => issue.id === "LONG_FILE")).toBe(true);
  });

  test("does not treat route support files like route handlers", () => {
    const issues = runFileMetricsFromEntries([
      entry("/repo/apps/api/src/routes/assistant-schemas.ts", locLines(200)),
    ], { architecture: "modular-monolith" });

    expect(issues.some((issue) => issue.id === "LONG_FILE")).toBe(false);
  });

  test("requires a second complexity signal before emitting GOD_FILE", () => {
    const withoutSignal = runFileMetricsFromEntries([
      entry("/repo/src/large.ts", locLines(900)),
    ]);
    const withSignal = runFileMetricsFromEntries([
      entry(
        "/repo/src/import-heavy.ts",
        [
          ...Array.from({ length: 20 }, (_, i) => `import mod${i} from \"./dep-${i}\";`),
          locLines(900, "body"),
        ].join("\n")
      ),
    ]);

    expect(withoutSignal.some((issue) => issue.id === "GOD_FILE")).toBe(false);
    expect(withoutSignal.some((issue) => issue.id === "LARGE_FILE")).toBe(true);
    expect(withSignal.some((issue) => issue.id === "GOD_FILE")).toBe(true);
  });

  test("lifts dense UI cohorts relative to their peers", () => {
    const issues = runFileMetricsFromEntries([
      entry("/repo/apps/web/src/features/workspace/components/deals-table.tsx", locLines(850, "deal")),
      entry("/repo/apps/web/src/features/workspace/components/funds-table.tsx", locLines(900, "fund")),
      entry("/repo/apps/web/src/features/workspace/components/overview-dashboard.tsx", locLines(950, "dashboard")),
      entry("/repo/apps/web/src/features/workspace/components/knowledge-graph.tsx", locLines(1000, "graph")),
      entry("/repo/apps/web/src/features/workspace/components/collection-detail.tsx", locLines(1050, "detail")),
    ]);

    const graphIssues = issues.filter((issue) => issue.file.endsWith("knowledge-graph.tsx"));
    expect(graphIssues.some((issue) => issue.id === "GOD_FILE")).toBe(false);
    expect(graphIssues.some((issue) => issue.id === "LARGE_FILE")).toBe(true);
  });

  test("allows curated package index barrels for modular-monolith", () => {
    const issues = runFileMetricsFromEntries([
      entry(
        "/repo/packages/db/src/documents/index.ts",
        [
          'export { createDocument } from "./create";',
          'export { listDocuments } from "./list";',
          'export { updateDocument } from "./update";',
          'export { deleteDocument } from "./delete";',
        ].join("\n")
      ),
    ], { architecture: "modular-monolith" });

    expect(issues.some((issue) => issue.id === "BARREL_FILE")).toBe(false);
  });

  test("still flags star re-exports for modular-monolith", () => {
    const issues = runFileMetricsFromEntries([
      entry("/repo/packages/db/src/documents/index.ts", 'export * from "./create";'),
    ], { architecture: "modular-monolith" });

    expect(issues.some((issue) => issue.id === "STAR_REEXPORT")).toBe(true);
  });
});

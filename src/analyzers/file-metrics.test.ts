import { describe, expect, test } from "bun:test";
import { runFileMetricsFromEntries } from "./file-metrics";
import type { FileEntry } from "./file-walker";

function entry(path: string, content: string): FileEntry {
  return { path, content, lines: content.split("\n") };
}

describe("runFileMetricsFromEntries", () => {
  test("flags long files at the new default soft limit", () => {
    const content = Array.from({ length: 300 }, (_, i) => `const line${i} = ${i};`).join("\n");
    const issues = runFileMetricsFromEntries([entry("/repo/src/large.ts", content)]);

    expect(issues.some((issue) => issue.id === "LONG_FILE")).toBe(true);
  });

  test("applies stricter route thresholds for modular-monolith", () => {
    const content = Array.from({ length: 150 }, (_, i) => `const line${i} = ${i};`).join("\n");
    const issues = runFileMetricsFromEntries([
      entry("/repo/apps/api/src/routes/documents/create.ts", content),
    ], { architecture: "modular-monolith" });

    expect(issues.some((issue) => issue.id === "LONG_FILE")).toBe(true);
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

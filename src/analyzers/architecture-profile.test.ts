import { describe, expect, test } from "bun:test";
import { runArchitectureProfileFromEntries } from "./architecture-profile";
import type { FileEntry } from "./file-walker";

function entry(path: string, content: string): FileEntry {
  return { path, content, lines: content.split("\n") };
}

describe("runArchitectureProfileFromEntries", () => {
  test("flags route files importing repository internals under modular-monolith", () => {
    const issues = runArchitectureProfileFromEntries([
      entry(
        "/repo/apps/api/src/routes/documents/create.ts",
        'import { saveDoc } from "../../repositories/documents";'
      ),
    ], { architecture: "modular-monolith" });

    expect(issues.some((issue) => issue.id === "LAYER_BOUNDARY_VIOLATION")).toBe(true);
  });

  test("flags private cross-module imports under modular-monolith", () => {
    const issues = runArchitectureProfileFromEntries([
      entry(
        "/repo/packages/app/src/orders/service.ts",
        'import { userRepo } from "../users/repository";'
      ),
    ], { architecture: "modular-monolith" });

    expect(issues.some((issue) => issue.id === "PRIVATE_MODULE_IMPORT")).toBe(true);
  });

  test("allows curated public module index imports", () => {
    const issues = runArchitectureProfileFromEntries([
      entry(
        "/repo/packages/app/src/orders/service.ts",
        'import { userRepo } from "../users/index";'
      ),
    ], { architecture: "modular-monolith" });

    expect(issues.some((issue) => issue.id === "PRIVATE_MODULE_IMPORT")).toBe(false);
  });

  test("does nothing when no architecture profile is active", () => {
    const issues = runArchitectureProfileFromEntries([
      entry(
        "/repo/apps/api/src/routes/documents/create.ts",
        'import { saveDoc } from "../../repositories/documents";'
      ),
    ]);

    expect(issues).toHaveLength(0);
  });
});

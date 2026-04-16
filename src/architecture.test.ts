import { describe, expect, test } from "bun:test";
import { buildArchitectureSummary, getArchitectureProfile, resolveArchitectureProfileName } from "./architecture";

describe("architecture profiles", () => {
  test("resolves alias to modular-monolith", () => {
    expect(resolveArchitectureProfileName("gii-mvp")).toBe("modular-monolith");
  });

  test("builds architecture summaries", () => {
    const summary = buildArchitectureSummary("modular-monolith", [
      {
        id: "PRIVATE_MODULE_IMPORT",
        category: "inconsistency",
        severity: "MEDIUM",
        tier: 0,
        file: "/repo/src/a.ts",
        line: 1,
        message: "x",
        tool: "architecture-profile",
      },
    ]);

    expect(summary?.profile).toBe("modular-monolith");
    expect(summary?.violations.PRIVATE_MODULE_IMPORT).toBe(1);
    expect(getArchitectureProfile("modular-monolith")?.ruleIds).toContain("LAYER_BOUNDARY_VIOLATION");
  });
});

import { describe, expect, test } from "bun:test";
import { getBuiltinPackDefinition } from "../pack-registry";
import type { PackDefinition } from "./pack-definition";

describe("pack definition", () => {
  test("built-in definitions satisfy the canonical aggregate contract", () => {
    const definition: PackDefinition = getBuiltinPackDefinition("js-ts");

    expect(definition.meta.name).toBe("js-ts");
    expect(typeof definition.runInternal).toBe("function");
    expect(typeof definition.listExternalAnalyzerIds).toBe("function");
    expect(typeof definition.getExternalTasks).toBe("function");
  });
});

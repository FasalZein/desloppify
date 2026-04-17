import { describe, expect, test } from "bun:test";
import { getPackMeta, resolvePackSelection } from "./packs";

describe("packs", () => {
  test("defaults to js-ts pack", () => {
    const pack = resolvePackSelection();

    expect(pack).toEqual({ name: "js-ts", explicit: false });
    expect(getPackMeta(pack.name).description).toContain("JavaScript");
  });

  test("rejects unknown packs", () => {
    expect(() => resolvePackSelection("python")).toThrow("Unknown pack: python");
  });
});

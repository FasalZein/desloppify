import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getMadgeTargets } from "./madge";

describe("madge target discovery", () => {
  test("uses workspace package roots when workspaces are declared", () => {
    const root = mkdtempSync(join(tmpdir(), "desloppify-madge-"));
    try {
      writeFileSync(join(root, "package.json"), JSON.stringify({ workspaces: ["apps/*", "packages/*"] }));
      mkdirSync(join(root, "apps", "web"), { recursive: true });
      mkdirSync(join(root, "apps", "api"), { recursive: true });
      mkdirSync(join(root, "packages", "shared"), { recursive: true });
      mkdirSync(join(root, "packages", "docs"), { recursive: true });
      writeFileSync(join(root, "apps", "web", "package.json"), "{}");
      writeFileSync(join(root, "apps", "api", "package.json"), "{}");
      writeFileSync(join(root, "packages", "shared", "package.json"), "{}");

      expect(getMadgeTargets(root).sort()).toEqual([
        join("apps", "api"),
        join("apps", "web"),
        join("packages", "shared"),
      ].sort());
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("falls back to repo root when no supported workspaces are declared", () => {
    const root = mkdtempSync(join(tmpdir(), "desloppify-madge-"));
    try {
      writeFileSync(join(root, "package.json"), JSON.stringify({ name: "demo" }));
      expect(getMadgeTargets(root)).toEqual([root]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

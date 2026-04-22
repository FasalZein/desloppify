import { describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getMadgeTargets, runMadge } from "./madge";

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

  test("resolves workspace cycle paths against the scanned repo root", async () => {
    const root = mkdtempSync(join(tmpdir(), "desloppify-madge-"));
    try {
      writeFileSync(join(root, "package.json"), JSON.stringify({ workspaces: ["apps/*"] }));
      mkdirSync(join(root, "apps", "web", "src"), { recursive: true });
      writeFileSync(join(root, "apps", "web", "package.json"), "{}");
      mkdirSync(join(root, "node_modules", ".bin"), { recursive: true });
      const madgeBin = join(root, "node_modules", ".bin", "madge");
      writeFileSync(madgeBin, "#!/bin/sh\nprintf '[[%s]]\\n' '\"src/a.ts\",\"src/b.ts\"'\n", "utf8");
      chmodSync(madgeBin, 0o755);

      const result = await runMadge(root);

      expect(result.warning).toBeUndefined();
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toMatchObject({
        file: join(root, "apps", "web", "src", "a.ts"),
      });
      expect(result.issues[0]?.message).toContain(join(root, "apps", "web", "src", "a.ts"));
      expect(result.issues[0]?.message).toContain(join(root, "apps", "web", "src", "b.ts"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

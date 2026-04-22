import { describe, expect, test } from "bun:test";
import { parseKnipReport } from "./knip";

describe("knip parser", () => {
  test("parses modern knip issues json", () => {
    const issues = parseKnipReport(JSON.stringify({
      issues: [
        {
          file: "apps/web/src/example.ts",
          files: [{ name: "apps/web/src/example.ts" }],
          exports: [{ name: "unusedFn", line: 12 }],
          types: [{ name: "UnusedType", line: 20 }],
          dependencies: [{ name: "left-pad", line: 4 }],
          devDependencies: [{ name: "vitest", line: 8 }],
          unlisted: [{ name: "fastify", line: 2 }],
        },
      ],
    }));

    expect(issues).toEqual([
      expect.objectContaining({ id: "DEAD_FILE", file: "apps/web/src/example.ts", deltaIdentity: "file:apps/web/src/example.ts" }),
      expect.objectContaining({ id: "DEAD_EXPORT", file: "apps/web/src/example.ts", line: 12, message: "Unused export: unusedFn", deltaIdentity: "export:unusedFn" }),
      expect.objectContaining({ id: "DEAD_EXPORT", file: "apps/web/src/example.ts", line: 20, message: "Unused type export: UnusedType", deltaIdentity: "type-export:UnusedType" }),
      expect.objectContaining({ id: "DEAD_DEPENDENCY", file: "apps/web/src/example.ts", line: 4, message: "Unused dependency: left-pad", deltaIdentity: "dependency:left-pad" }),
      expect.objectContaining({ id: "DEAD_DEPENDENCY", file: "apps/web/src/example.ts", line: 8, message: "Unused dependency: vitest", deltaIdentity: "dependency:vitest" }),
      expect.objectContaining({ id: "UNLISTED_DEPENDENCY", file: "apps/web/src/example.ts", line: 2, message: "Unlisted dependency: fastify", deltaIdentity: "unlisted:fastify" }),
    ]);
  });

  test("parses legacy knip json", () => {
    const issues = parseKnipReport(JSON.stringify({
      files: ["src/unused.ts"],
      exports: {
        "src/example.ts": [{ name: "unusedFn", line: 7 }],
      },
      dependencies: {
        lodash: {},
      },
      unlisted: {
        "src/example.ts": ["zod"],
      },
    }));

    expect(issues).toEqual([
      expect.objectContaining({ id: "DEAD_FILE", file: "src/unused.ts", deltaIdentity: "file:src/unused.ts" }),
      expect.objectContaining({ id: "DEAD_EXPORT", file: "src/example.ts", line: 7, message: "Unused export: unusedFn", deltaIdentity: "export:unusedFn" }),
      expect.objectContaining({ id: "DEAD_DEPENDENCY", file: "package.json", message: "Unused dependency: lodash", deltaIdentity: "dependency:lodash" }),
      expect.objectContaining({ id: "UNLISTED_DEPENDENCY", file: "src/example.ts", message: "Unlisted dependency: zod", deltaIdentity: "unlisted:zod" }),
    ]);
  });
});

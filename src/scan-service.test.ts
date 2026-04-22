import { describe, expect, test } from "bun:test";
import { normalizeIssuePaths } from "./scan-service";
import type { Issue } from "./types";

const issue = (file: string): Issue => ({
  id: "TEST_RULE",
  category: "dead-code",
  severity: "MEDIUM",
  tier: 1,
  file,
  line: 1,
  message: "test issue",
  tool: "test",
});

describe("normalizeIssuePaths", () => {
  test("resolves relative external paths against the scanned repo root", () => {
    const [relativeFile, relativeRootFile, absoluteFile, unknownFile] = normalizeIssuePaths("/repo", [
      issue("src/example.ts"),
      issue("package.json"),
      issue("/repo/src/already-absolute.ts"),
      issue("unknown"),
    ]);

    expect(relativeFile?.file).toBe("/repo/src/example.ts");
    expect(relativeRootFile?.file).toBe("/repo/package.json");
    expect(absoluteFile?.file).toBe("/repo/src/already-absolute.ts");
    expect(unknownFile?.file).toBe("unknown");
  });
});

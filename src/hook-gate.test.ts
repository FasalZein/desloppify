import { describe, expect, test } from "bun:test";
import { getBlockingFindings } from "./hook-gate";
import type { Finding } from "./types";

function finding(severity: Finding["severity"]): Finding {
  return {
    id: `${severity}-id`,
    rule_id: `${severity}_RULE`,
    level: severity === "LOW" ? "note" : severity === "MEDIUM" ? "warning" : "error",
    severity,
    category: "dead-code",
    message: `${severity} issue`,
    tool: "grep",
    locations: [
      {
        path: "/repo/src/example.ts",
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 1 },
        },
      },
    ],
    primary_location_index: 0,
    fingerprints: { primary: `${severity}-fp` },
  };
}

describe("hook gate", () => {
  test("keeps only high and critical findings", () => {
    const blocking = getBlockingFindings([
      finding("LOW"),
      finding("MEDIUM"),
      finding("HIGH"),
      finding("CRITICAL"),
    ]);

    expect(blocking.map((item) => item.severity)).toEqual(["HIGH", "CRITICAL"]);
  });
});

import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getBlockingDeltaChanges, getBlockingFindings } from "./hook-gate";
import type { Finding } from "./types";
import type { FindingDelta, ScanDeltaReport } from "./scan-delta";

let tempRoot: string | undefined;

afterEach(() => {
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = undefined;
});

function findingLevel(severity: Finding["severity"]): Finding["level"] {
  if (severity === "LOW") return "note";
  if (severity === "MEDIUM") return "warning";
  return "error";
}

function finding(severity: Finding["severity"]): Finding {
  return {
    id: `${severity}-id`,
    rule_id: `${severity}_RULE`,
    level: findingLevel(severity),
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

function deltaChange(status: FindingDelta["status"], severity: Finding["severity"]): FindingDelta {
  const head = finding(severity);
  return {
    status,
    ruleId: head.rule_id,
    path: "/repo/src/example.ts",
    fingerprint: head.fingerprints.primary,
    base: status === "added" ? null : head,
    head: status === "resolved" ? null : head,
  };
}

function runHookGate(report: { findings: Finding[] }, delta: ScanDeltaReport | null) {
  tempRoot = mkdtempSync(join(tmpdir(), "desloppify-hook-gate-"));
  if (delta) {
    mkdirSync(join(tempRoot, ".desloppify", "reports"), { recursive: true });
    writeFileSync(join(tempRoot, ".desloppify", "reports", "latest.delta.json"), JSON.stringify(delta));
  }

  const payload = JSON.stringify(report).replace(/'/g, `'"'"'`);
  return Bun.spawnSync(["bash", "-lc", `printf '%s' '${payload}' | bun '${join(process.cwd(), "src", "hook-gate.ts")}' commit`], {
    cwd: tempRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
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

  test("keeps only added or worsened high and critical delta changes", () => {
    const blocking = getBlockingDeltaChanges([
      deltaChange("unchanged", "CRITICAL"),
      deltaChange("improved", "HIGH"),
      deltaChange("added", "MEDIUM"),
      deltaChange("added", "HIGH"),
      deltaChange("worsened", "CRITICAL"),
    ]);

    expect(blocking.map((item) => item.status)).toEqual(["added", "worsened"]);
  });

  test("falls back to current findings when no delta artifact exists", () => {
    const result = runHookGate({ findings: [finding("HIGH")] }, null);
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("blocking commit: 1 high/critical issue");
  });

  test("ignores unchanged legacy blockers when delta exists", () => {
    const result = runHookGate({ findings: [finding("HIGH")] }, {
      summary: {
        baseFindingCount: 1,
        headFindingCount: 1,
        addedCount: 0,
        resolvedCount: 0,
        unchangedCount: 1,
        worsenedCount: 0,
        improvedCount: 0,
        changed: false,
      },
      changes: [deltaChange("unchanged", "HIGH")],
    });

    expect(result.exitCode).toBe(0);
  });

  test("blocks new or worsened high severity findings when delta exists", () => {
    const result = runHookGate({ findings: [finding("HIGH")] }, {
      summary: {
        baseFindingCount: 0,
        headFindingCount: 1,
        addedCount: 1,
        resolvedCount: 0,
        unchangedCount: 0,
        worsenedCount: 0,
        improvedCount: 0,
        changed: true,
      },
      changes: [deltaChange("added", "HIGH")],
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("new/worsened high/critical issue");
  });
});

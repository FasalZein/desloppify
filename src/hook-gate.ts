import type { Finding } from "./types";
import {
  getBlockingDeltaChanges,
  getBlockingFindings,
  loadSavedScanDeltaReport,
} from "./scan-workflow";

export { getBlockingDeltaChanges, getBlockingFindings };

function hookModeNoun(mode: string): string {
  if (mode === "commit") return "commit";
  if (mode === "push") return "push";
  return mode;
}

export function runHookGate(report: { findings?: Finding[] }, mode = "run", rootPath = process.cwd()): number {
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const noun = hookModeNoun(mode);
  const delta = loadSavedScanDeltaReport(rootPath);

  if (delta) {
    const blockingDelta = getBlockingDeltaChanges(delta.changes);
    if (blockingDelta.length > 0) {
      console.error(`\n[desloppify] blocking ${noun}: ${blockingDelta.length} new/worsened high/critical issue(s)`);
      return 1;
    }
    return 0;
  }

  const blocking = getBlockingFindings(findings);
  if (blocking.length > 0) {
    console.error(`\n[desloppify] blocking ${noun}: ${blocking.length} high/critical issue(s)`);
    return 1;
  }

  return 0;
}

export async function main(mode = process.argv[2] ?? "run") {
  const input = await new Response(Bun.stdin.stream()).text();
  const report = JSON.parse(input) as { findings?: Finding[] };
  const exitCode = runHookGate(report, mode);
  if (exitCode !== 0) process.exit(exitCode);
}

if (import.meta.main) {
  main();
}

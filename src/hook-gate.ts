import type { Finding } from "./types";

export function getBlockingFindings(findings: Finding[]): Finding[] {
  return findings.filter((finding) => finding.severity === "CRITICAL" || finding.severity === "HIGH");
}

async function main() {
  const input = await new Response(Bun.stdin.stream()).text();
  const report = JSON.parse(input) as { findings?: Finding[] };
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const blocking = getBlockingFindings(findings);
  const mode = process.argv[2] ?? "run";

  if (blocking.length > 0) {
    const noun = mode === "commit" ? "commit" : mode === "push" ? "push" : mode;
    console.error(`\n[desloppify] blocking ${noun}: ${blocking.length} high/critical issue(s)`);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}

import type { Finding, ScanReport, Severity } from "./types";

export type DeltaStatus = "added" | "resolved" | "unchanged" | "worsened" | "improved";
export type DeltaMatchReason = "primary" | "path_rule_delta" | "path_rule_message" | "path_rule" | "rule_delta" | "rule_message";

export interface FindingDelta {
  status: DeltaStatus;
  ruleId: string;
  path: string | null;
  fingerprint: string;
  base: Finding | null;
  head: Finding | null;
  matchedBy?: DeltaMatchReason;
}

export interface ScanDeltaSummary {
  baseFindingCount: number;
  headFindingCount: number;
  addedCount: number;
  resolvedCount: number;
  unchangedCount: number;
  worsenedCount: number;
  improvedCount: number;
  changed: boolean;
}

export interface ScanDeltaReport {
  summary: ScanDeltaSummary;
  changes: FindingDelta[];
}

interface IndexedFinding {
  finding: Finding;
  path: string | null;
  matched: boolean;
}

const MATCH_REASONS: DeltaMatchReason[] = ["primary", "path_rule_delta", "path_rule_message", "path_rule", "rule_delta", "rule_message"];

function severityRank(severity: Severity): number {
  switch (severity) {
    case "LOW":
      return 1;
    case "MEDIUM":
      return 2;
    case "HIGH":
      return 3;
    case "CRITICAL":
      return 4;
  }
}

function primaryLocationPath(finding: Finding): string | null {
  return finding.locations[finding.primary_location_index]?.path ?? finding.locations[0]?.path ?? null;
}

function matchKey(finding: Finding, reason: DeltaMatchReason): string | null {
  const primary = finding.fingerprints.primary;
  const partial = finding.fingerprints.partial;
  if (!partial && reason !== "primary") return null;

  switch (reason) {
    case "primary":
      return primary ?? null;
    case "path_rule_delta":
      return partial?.path_rule_delta ?? null;
    case "path_rule_message":
      return partial?.path_rule_message ?? null;
    case "path_rule":
      return partial?.path_rule ?? null;
    case "rule_delta":
      return partial?.rule_delta ?? null;
    case "rule_message":
      return partial?.rule_message ?? null;
  }
}

function classifyMatch(base: Finding, head: Finding): DeltaStatus {
  const delta = severityRank(head.severity) - severityRank(base.severity);
  if (delta > 0) return "worsened";
  if (delta < 0) return "improved";
  return "unchanged";
}

function indexFindings(findings: Finding[]): IndexedFinding[] {
  return findings.map((finding) => ({
    finding,
    path: primaryLocationPath(finding),
    matched: false,
  }));
}

function compareFindingOrder(left: IndexedFinding, right: IndexedFinding): number {
  return (
    (left.path ?? "").localeCompare(right.path ?? "") ||
    left.finding.rule_id.localeCompare(right.finding.rule_id) ||
    left.finding.message.localeCompare(right.finding.message) ||
    left.finding.fingerprints.primary.localeCompare(right.finding.fingerprints.primary)
  );
}

export function compareScanReports(base: ScanReport, head: ScanReport): ScanDeltaReport {
  const baseIndexed = indexFindings(base.findings).sort(compareFindingOrder);
  const headIndexed = indexFindings(head.findings).sort(compareFindingOrder);
  const changes: FindingDelta[] = [];

  for (const reason of MATCH_REASONS) {
    const buckets = new Map<string, IndexedFinding[]>();

    for (const baseFinding of baseIndexed) {
      if (baseFinding.matched) continue;
      const key = matchKey(baseFinding.finding, reason);
      if (!key) continue;
      const existingList = buckets.get(key);
      const list = existingList ? [...existingList] : [];
      list.push(baseFinding);
      buckets.set(key, list);
    }

    for (const headFinding of headIndexed) {
      if (headFinding.matched) continue;
      const key = matchKey(headFinding.finding, reason);
      if (!key) continue;
      const candidates = buckets.get(key);
      if (!candidates) continue;
      const baseFinding = candidates.find((candidate) => !candidate.matched);
      if (!baseFinding) continue;

      baseFinding.matched = true;
      headFinding.matched = true;
      changes.push({
        status: classifyMatch(baseFinding.finding, headFinding.finding),
        ruleId: headFinding.finding.rule_id,
        path: headFinding.path,
        fingerprint: headFinding.finding.fingerprints.primary,
        base: baseFinding.finding,
        head: headFinding.finding,
        matchedBy: reason,
      });
    }
  }

  for (const finding of headIndexed) {
    if (finding.matched) continue;
    changes.push({
      status: "added",
      ruleId: finding.finding.rule_id,
      path: finding.path,
      fingerprint: finding.finding.fingerprints.primary,
      base: null,
      head: finding.finding,
    });
  }

  for (const finding of baseIndexed) {
    if (finding.matched) continue;
    changes.push({
      status: "resolved",
      ruleId: finding.finding.rule_id,
      path: finding.path,
      fingerprint: finding.finding.fingerprints.primary,
      base: finding.finding,
      head: null,
    });
  }

  const summary: ScanDeltaSummary = {
    baseFindingCount: base.findings.length,
    headFindingCount: head.findings.length,
    addedCount: changes.filter((change) => change.status === "added").length,
    resolvedCount: changes.filter((change) => change.status === "resolved").length,
    unchangedCount: changes.filter((change) => change.status === "unchanged").length,
    worsenedCount: changes.filter((change) => change.status === "worsened").length,
    improvedCount: changes.filter((change) => change.status === "improved").length,
    changed: changes.some((change) => change.status !== "unchanged"),
  };

  return { summary, changes };
}

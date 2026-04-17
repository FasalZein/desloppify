import type { Finding, RuleDefinition, ScanReport } from "./types";

export interface WikiWorkflowContext {
  project?: string;
  sliceId?: string;
  prdId?: string;
  featureId?: string;
}

export interface WikiAction {
  kind: "fix-code" | "review-finding" | "closeout";
  priority: number;
  message: string;
  findingIds?: string[];
}

export interface WikiReport {
  schema: "wiki-forge.review/v1";
  meta: {
    generatedAt: string;
    path: string;
    pack: ScanReport["scan"]["pack"];
    architecture?: string;
    project?: string;
    sliceId?: string;
    prdId?: string;
    featureId?: string;
  };
  summary: {
    ok: boolean;
    blocking: number;
    warning: number;
    info: number;
  };
  rules: Record<string, RuleDefinition>;
  findings: Finding[];
  actions: WikiAction[];
  blockers: string[];
  warnings: string[];
  nextSteps: string[];
  handoff: {
    activeSlice?: string;
    nextSessionPrompt: string;
    resumeHint?: string;
    unresolvedFindingFingerprints: string[];
  };
}

function isBlocking(finding: Finding): boolean {
  return finding.severity === "CRITICAL" || finding.severity === "HIGH";
}

function describeFinding(finding: Finding): string {
  const location = primaryLocation(finding);
  return `${finding.rule_id} at ${location.path}:${location.range.start.line} — ${finding.message}`;
}

function primaryLocation(finding: Finding) {
  return finding.locations[finding.primary_location_index] ?? finding.locations[0] ?? {
    path: "<unknown>",
    range: {
      start: { line: 0, column: 0 },
      end: { line: 0, column: 0 },
    },
  };
}

export function buildWikiReport(report: ScanReport, context: WikiWorkflowContext = {}): WikiReport {
  const blockingFindings = report.findings.filter(isBlocking);
  const warningFindings = report.findings.filter((finding) => finding.severity === "MEDIUM");
  const infoFindings = report.findings.filter((finding) => finding.severity === "LOW");

  const blockers = blockingFindings.map(describeFinding);

  const warnings = warningFindings.map(describeFinding);

  const actions: WikiAction[] = [];
  if (blockingFindings.length) {
    actions.push({
      kind: "fix-code",
      priority: 1,
      message: `Resolve ${blockingFindings.length} blocking finding(s) before closeout`,
      findingIds: blockingFindings.map((finding) => finding.id),
    });
  }
  if (warningFindings.length || infoFindings.length) {
    actions.push({
      kind: "review-finding",
      priority: blockingFindings.length ? 2 : 1,
      message: `Review ${warningFindings.length + infoFindings.length} non-blocking finding(s) for follow-up`,
      findingIds: [...warningFindings, ...infoFindings].map((finding) => finding.id),
    });
  }
  actions.push({
    kind: "closeout",
    priority: blockingFindings.length ? 3 : 2,
    message: context.project
      ? `Run wiki closeout ${context.project} after code and wiki pages are updated`
      : "Run wiki closeout after code and wiki pages are updated",
  });

  const nextSteps = blockingFindings.length > 0
    ? [
        "Fix blocking findings",
        "Update impacted wiki pages from code",
        context.project
          ? `wiki closeout ${context.project} --repo <path> --base <rev>`
          : "wiki closeout <project> --repo <path> --base <rev>",
      ]
    : [
        "Review remaining findings",
        "Update impacted wiki pages from code",
        context.project
          ? `wiki closeout ${context.project} --repo <path> --base <rev>`
          : "wiki closeout <project> --repo <path> --base <rev>",
      ];

  return {
    schema: "wiki-forge.review/v1",
    meta: {
      generatedAt: report.scan.generatedAt,
      path: report.scan.path,
      pack: report.scan.pack,
      architecture: report.architecture?.profile,
      project: context.project,
      sliceId: context.sliceId,
      prdId: context.prdId,
      featureId: context.featureId,
    },
    summary: {
      ok: blockingFindings.length === 0,
      blocking: blockingFindings.length,
      warning: warningFindings.length,
      info: infoFindings.length,
    },
    rules: report.rules,
    findings: report.findings,
    actions,
    blockers,
    warnings,
    nextSteps,
    handoff: {
      activeSlice: context.sliceId,
      nextSessionPrompt: context.sliceId
        ? `Continue ${context.sliceId}: resolve remaining findings, update wiki pages, and re-run wiki closeout with --base <rev>.`
        : "Continue resolving findings, update wiki pages, and re-run wiki closeout with --base <rev>.",
      unresolvedFindingFingerprints: report.findings.map((finding) => finding.fingerprints.primary),
    },
  };
}

export function formatWikiHandoffMarkdown(report: WikiReport): string {
  const lines = [
    `# Review handoff${report.meta.sliceId ? ` — ${report.meta.sliceId}` : ""}`,
    "",
    "## TL;DR",
    report.summary.ok
      ? `${report.summary.warning + report.summary.info} non-blocking finding(s). Ready for wiki closeout after page review.`
      : `${report.summary.blocking} blocker(s), ${report.summary.warning + report.summary.info} non-blocking finding(s). Not ready for closeout.`,
    "",
    "## Blocking findings",
  ];

  if (report.blockers.length === 0) lines.push("- none");
  else for (const blocker of report.blockers) lines.push(`- ${blocker}`);

  const nonBlocking = report.findings.filter((finding) => !isBlocking(finding));
  if (nonBlocking.length > 0) {
    lines.push("", "## Non-blocking findings");
    for (const finding of nonBlocking) lines.push(`- ${describeFinding(finding)}`);
  }

  lines.push("", "## Required wiki actions");
  for (const step of report.nextSteps) lines.push(`- ${step}`);

  lines.push("", "## Next Session Priorities");
  for (const action of report.actions) lines.push(`- ${action.message}`);

  return lines.join("\n");
}

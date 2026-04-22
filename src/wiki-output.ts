import type { ScanDeltaReport } from "./scan-delta";
import type { Finding, RuleDefinition, ScanReport } from "./types";

interface WikiWorkflowContext {
  project?: string;
  sliceId?: string;
  prdId?: string;
  featureId?: string;
  deltaReport?: ScanDeltaReport | null;
}

export interface WikiAction {
  kind: "fix-code" | "review-finding" | "closeout";
  priority: number;
  message: string;
  findingIds?: string[];
}

export interface WikiWorkflowCommand {
  id: string;
  label: string;
  command: string;
  exec?: {
    command: string;
    args: string[];
  };
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
    newBlocking?: number;
    resolved?: number;
  };
  delta?: {
    added: number;
    resolved: number;
    worsened: number;
    improved: number;
    newBlocking: number;
    existingBlocking: number;
  };
  rules: Record<string, RuleDefinition>;
  findings: Finding[];
  actions: WikiAction[];
  workflowCommands: WikiWorkflowCommand[];
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
  const delta = context.deltaReport ?? null;
  const deltaChanges = delta ? delta.changes : [];
  const newBlockingChanges = deltaChanges.filter((change) => {
    if (change.status !== "added" && change.status !== "worsened") return false;
    const head = change.head;
    return Boolean(head && isBlocking(head));
  });
  const newBlockingFingerprints = new Set(newBlockingChanges.map((change) => change.head?.fingerprints.primary).filter(Boolean));
  const newBlockingFindings = blockingFindings.filter((finding) => newBlockingFingerprints.has(finding.fingerprints.primary));
  const existingBlockingFindings = blockingFindings.filter((finding) => !newBlockingFingerprints.has(finding.fingerprints.primary));

  const blockers = blockingFindings.map(describeFinding);
  const warnings = warningFindings.map(describeFinding);

  const actions: WikiAction[] = [];
  if (newBlockingFindings.length) {
    actions.push({
      kind: "fix-code",
      priority: 1,
      message: `Resolve ${newBlockingFindings.length} newly introduced blocking finding(s) before closeout`,
      findingIds: newBlockingFindings.map((finding) => finding.id),
    });
  } else if (blockingFindings.length) {
    actions.push({
      kind: "fix-code",
      priority: 1,
      message: `Resolve ${blockingFindings.length} blocking finding(s) before closeout`,
      findingIds: blockingFindings.map((finding) => finding.id),
    });
  }
  if (delta && (delta.summary.addedCount || delta.summary.resolvedCount || delta.summary.worsenedCount || delta.summary.improvedCount)) {
    actions.push({
      kind: "review-finding",
      priority: blockingFindings.length ? 2 : 1,
      message: `Review scan delta: ${delta.summary.addedCount} added, ${delta.summary.resolvedCount} resolved, ${delta.summary.worsenedCount} worsened, ${delta.summary.improvedCount} improved`,
    });
  }
  if (warningFindings.length || infoFindings.length) {
    actions.push({
      kind: "review-finding",
      priority: blockingFindings.length ? 3 : 2,
      message: `Review ${warningFindings.length + infoFindings.length} non-blocking finding(s) for follow-up`,
      findingIds: [...warningFindings, ...infoFindings].map((finding) => finding.id),
    });
  }
  actions.push({
    kind: "closeout",
    priority: blockingFindings.length ? 4 : 3,
    message: context.project
      ? `Run wiki closeout ${context.project} after code and wiki pages are updated`
      : "Run wiki closeout after code and wiki pages are updated",
  });

  const closeoutCommand = context.project
    ? `wiki closeout ${context.project} --repo <path> --base <rev>`
    : "wiki closeout <project> --repo <path> --base <rev>";

  const nextSteps = newBlockingFindings.length > 0
    ? [
        "Fix newly introduced blocking findings",
        delta ? "Review the delta report for new and resolved findings" : "Review the current findings report",
        "Update impacted wiki pages from code",
        closeoutCommand,
      ]
    : blockingFindings.length > 0
      ? [
          "Fix blocking findings",
          delta ? "Review the delta report for newly introduced findings" : "Review the current findings report",
          "Update impacted wiki pages from code",
          closeoutCommand,
        ]
      : [
          delta ? "Review the delta report for newly introduced findings" : "Review remaining findings",
          "Update impacted wiki pages from code",
          closeoutCommand,
        ];

  const findingsPath = `${report.scan.path}/.desloppify/reports/latest.findings.json`;
  const deltaPath = `${report.scan.path}/.desloppify/reports/latest.delta.json`;
  const workflowCommands: WikiWorkflowCommand[] = [
    {
      id: "read-findings",
      label: "Read machine findings",
      command: `cat ${findingsPath}`,
      exec: {
        command: "cat",
        args: [findingsPath],
      },
    },
    ...(delta ? [{
      id: "read-delta",
      label: "Read scan delta",
      command: `cat ${deltaPath}`,
      exec: {
        command: "cat",
        args: [deltaPath],
      },
    } satisfies WikiWorkflowCommand] : []),
    {
      id: "prepare-fixes",
      label: "Prepare fix workflow",
      command: `desloppify worktrees ${report.scan.path}`,
      exec: {
        command: "desloppify",
        args: ["worktrees", report.scan.path],
      },
    },
    {
      id: "wiki-closeout",
      label: "Run wiki closeout",
      command: closeoutCommand,
    },
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
      newBlocking: newBlockingFindings.length,
      resolved: delta?.summary.resolvedCount,
    },
    delta: delta ? {
      added: delta.summary.addedCount,
      resolved: delta.summary.resolvedCount,
      worsened: delta.summary.worsenedCount,
      improved: delta.summary.improvedCount,
      newBlocking: newBlockingFindings.length,
      existingBlocking: existingBlockingFindings.length,
    } : undefined,
    rules: report.rules,
    findings: report.findings,
    actions,
    workflowCommands,
    blockers,
    warnings,
    nextSteps,
    handoff: {
      activeSlice: context.sliceId,
      nextSessionPrompt: context.sliceId
        ? newBlockingFindings.length > 0
          ? `Continue ${context.sliceId}: resolve newly introduced blockers first, then update wiki pages and re-run wiki closeout with --base <rev>.`
          : `Continue ${context.sliceId}: resolve remaining findings, review the delta report, update wiki pages, and re-run wiki closeout with --base <rev>.`
        : newBlockingFindings.length > 0
          ? "Continue: resolve newly introduced blockers first, then update wiki pages and re-run wiki closeout with --base <rev>."
          : "Continue resolving findings, review the delta report, update wiki pages, and re-run wiki closeout with --base <rev>.",
      resumeHint: delta ? `Review ${deltaPath} for added/resolved findings before closeout.` : undefined,
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
      : report.summary.newBlocking
        ? `${report.summary.newBlocking} new blocker(s), ${report.summary.blocking - report.summary.newBlocking} existing blocker(s), ${report.summary.warning + report.summary.info} non-blocking finding(s). Not ready for closeout.`
        : `${report.summary.blocking} blocker(s), ${report.summary.warning + report.summary.info} non-blocking finding(s). Not ready for closeout.`,
  ];

  if (report.delta) {
    lines.push(
      "",
      "## Delta vs previous scan",
      `- Added: ${report.delta.added}`,
      `- Resolved: ${report.delta.resolved}`,
      `- Worsened: ${report.delta.worsened}`,
      `- Improved: ${report.delta.improved}`,
      `- New blocking findings: ${report.delta.newBlocking}`,
    );
  }

  const newBlocking = report.findings.filter((finding) => isBlocking(finding) && Boolean(report.delta) && report.handoff.unresolvedFindingFingerprints.includes(finding.fingerprints.primary) && report.summary.newBlocking && report.delta?.newBlocking && report.delta.newBlocking > 0)
    .filter((finding) => report.actions[0]?.findingIds?.includes(finding.id));
  const nonBlocking = report.findings.filter((finding) => !isBlocking(finding));

  lines.push("", "## Blocking findings");
  if (report.blockers.length === 0) {
    lines.push("- none");
  } else {
    if (newBlocking.length > 0) {
      lines.push("### New blocking findings");
      for (const finding of newBlocking) lines.push(`- ${describeFinding(finding)}`);
      const existingBlocking = report.findings.filter((finding) => isBlocking(finding) && !newBlocking.some((item) => item.id === finding.id));
      if (existingBlocking.length > 0) {
        lines.push("", "### Existing blocking findings");
        for (const finding of existingBlocking) lines.push(`- ${describeFinding(finding)}`);
      }
    } else {
      for (const blocker of report.blockers) lines.push(`- ${blocker}`);
    }
  }

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

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ScanDeltaReport } from "./scan-delta";
import type { Finding } from "./types";

export interface ScanWorkflowArtifacts {
  dir: string;
  findingsJson: string;
  reportMarkdown: string;
  wikiJson: string;
  handoffMarkdown: string;
  deltaJson: string;
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

interface WorkflowPolicyOptions {
  rootPath: string;
  project?: string;
  hasDelta?: boolean;
  hasBlockingFindings?: boolean;
  hasNewBlockingFindings?: boolean;
}

export function getScanWorkflowArtifacts(rootPath: string): ScanWorkflowArtifacts {
  const dir = join(rootPath, ".desloppify", "reports");
  return {
    dir,
    findingsJson: join(dir, "latest.findings.json"),
    reportMarkdown: join(dir, "latest.report.md"),
    wikiJson: join(dir, "latest.wiki.json"),
    handoffMarkdown: join(dir, "latest.handoff.md"),
    deltaJson: join(dir, "latest.delta.json"),
  };
}

export function loadSavedScanDeltaReport(rootPath: string): ScanDeltaReport | undefined {
  const { deltaJson } = getScanWorkflowArtifacts(rootPath);
  if (!existsSync(deltaJson)) return undefined;

  try {
    return JSON.parse(readFileSync(deltaJson, "utf8")) as ScanDeltaReport;
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

export function loadSavedJsonArtifact<T>(path: string): T | undefined {
  if (!existsSync(path)) return undefined;

  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

export function buildWikiCloseoutCommand(project?: string): string {
  return project
    ? `wiki closeout ${project} --repo <path> --base <rev>`
    : "wiki closeout <project> --repo <path> --base <rev>";
}

export function buildWorkflowCommands(options: WorkflowPolicyOptions): WikiWorkflowCommand[] {
  const artifacts = getScanWorkflowArtifacts(options.rootPath);

  return [
    {
      id: "read-findings",
      label: "Read machine findings",
      command: `cat ${artifacts.findingsJson}`,
      exec: {
        command: "cat",
        args: [artifacts.findingsJson],
      },
    },
    ...(options.hasDelta ? [{
      id: "read-delta",
      label: "Read scan delta",
      command: `cat ${artifacts.deltaJson}`,
      exec: {
        command: "cat",
        args: [artifacts.deltaJson],
      },
    } satisfies WikiWorkflowCommand] : []),
    {
      id: "prepare-fixes",
      label: "Prepare fix workflow",
      command: `desloppify worktrees ${options.rootPath}`,
      exec: {
        command: "desloppify",
        args: ["worktrees", options.rootPath],
      },
    },
    {
      id: "wiki-closeout",
      label: "Run wiki closeout",
      command: buildWikiCloseoutCommand(options.project),
    },
  ];
}

export function buildWorkflowNextSteps(options: WorkflowPolicyOptions): string[] {
  const closeoutCommand = buildWikiCloseoutCommand(options.project);

  if (options.hasNewBlockingFindings) {
    return [
      "Fix newly introduced blocking findings",
      options.hasDelta ? "Review the delta report for new and resolved findings" : "Review the current findings report",
      "Update impacted wiki pages from code",
      closeoutCommand,
    ];
  }

  if (options.hasBlockingFindings) {
    return [
      "Fix blocking findings",
      options.hasDelta ? "Review the delta report for newly introduced findings" : "Review the current findings report",
      "Update impacted wiki pages from code",
      closeoutCommand,
    ];
  }

  return [
    options.hasDelta ? "Review the delta report for newly introduced findings" : "Review remaining findings",
    "Update impacted wiki pages from code",
    closeoutCommand,
  ];
}

export function buildNextSessionPrompt(options: WorkflowPolicyOptions & { sliceId?: string }): string {
  if (options.sliceId) {
    return options.hasNewBlockingFindings
      ? `Continue ${options.sliceId}: resolve newly introduced blockers first, then update wiki pages and re-run wiki closeout with --base <rev>.`
      : `Continue ${options.sliceId}: resolve remaining findings, review the delta report, update wiki pages, and re-run wiki closeout with --base <rev>.`;
  }

  return options.hasNewBlockingFindings
    ? "Continue: resolve newly introduced blockers first, then update wiki pages and re-run wiki closeout with --base <rev>."
    : "Continue resolving findings, review the delta report, update wiki pages, and re-run wiki closeout with --base <rev>.";
}

export function getBlockingDeltaChanges(changes: ScanDeltaReport["changes"]): ScanDeltaReport["changes"] {
  return changes.filter((change) => {
    if (change.status !== "added" && change.status !== "worsened") return false;
    const severity = change.head?.severity;
    return severity === "CRITICAL" || severity === "HIGH";
  });
}

export function getBlockingFindings(findings: Finding[]): Finding[] {
  return findings.filter((finding) => finding.severity === "CRITICAL" || finding.severity === "HIGH");
}

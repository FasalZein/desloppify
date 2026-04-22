import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ScanDeltaReport } from "./scan-delta";
import type { ScanReport } from "./types";
import type { WikiReport } from "./wiki-output";

const LOCAL_REPORTS_DIR = ".desloppify/";

interface SavedReportArtifacts {
  dir: string;
  findingsJson: string;
  reportMarkdown: string;
  wikiJson: string;
  handoffMarkdown: string;
  deltaJson: string;
}

export function getReportArtifacts(rootPath: string): SavedReportArtifacts {
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

export function loadSavedScanReport(rootPath: string): ScanReport | undefined {
  const artifacts = getReportArtifacts(rootPath);
  if (!existsSync(artifacts.findingsJson)) return undefined;

  try {
    return JSON.parse(readFileSync(artifacts.findingsJson, "utf8")) as ScanReport;
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

function ensureLocalArtifactsGitignored(rootPath: string): void {
  if (!existsSync(join(rootPath, ".git"))) return;

  const gitignorePath = join(rootPath, ".gitignore");
  const current = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf8") : "";
  const lines = current.split(/\r?\n/).map((line) => line.trim());
  if (lines.includes(LOCAL_REPORTS_DIR) || lines.includes(LOCAL_REPORTS_DIR.slice(0, -1))) return;

  const prefix = current.length === 0 || current.endsWith("\n") ? "" : "\n";
  writeFileSync(gitignorePath, `${current}${prefix}${LOCAL_REPORTS_DIR}\n`, "utf8");
}

export function saveScanArtifacts(
  rootPath: string,
  report: ScanReport,
  wikiReport: WikiReport,
  reportMarkdown: string,
  handoffMarkdown: string,
  deltaReport?: ScanDeltaReport | null,
): SavedReportArtifacts {
  const artifacts = getReportArtifacts(rootPath);
  mkdirSync(artifacts.dir, { recursive: true });
  ensureLocalArtifactsGitignored(rootPath);

  writeFileSync(artifacts.findingsJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(artifacts.reportMarkdown, `${reportMarkdown}\n`, "utf8");
  writeFileSync(artifacts.wikiJson, `${JSON.stringify(wikiReport, null, 2)}\n`, "utf8");
  writeFileSync(artifacts.handoffMarkdown, `${handoffMarkdown}\n`, "utf8");

  if (deltaReport) {
    writeFileSync(artifacts.deltaJson, `${JSON.stringify(deltaReport, null, 2)}\n`, "utf8");
  } else if (existsSync(artifacts.deltaJson)) {
    rmSync(artifacts.deltaJson, { force: true });
  }

  return artifacts;
}

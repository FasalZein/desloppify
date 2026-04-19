import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ScanDeltaReport } from "./scan-delta";
import type { ScanReport } from "./types";
import type { WikiReport } from "./wiki-output";

export interface SavedReportArtifacts {
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

export function loadSavedScanReport(rootPath: string): ScanReport | null {
  const artifacts = getReportArtifacts(rootPath);
  if (!existsSync(artifacts.findingsJson)) return null;

  try {
    return JSON.parse(readFileSync(artifacts.findingsJson, "utf8")) as ScanReport;
  } catch {
    return null;
  }
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

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ScanReport } from "./types";
import type { WikiReport } from "./wiki-output";

export interface SavedReportArtifacts {
  dir: string;
  findingsJson: string;
  reportMarkdown: string;
  wikiJson: string;
  handoffMarkdown: string;
}

export function saveScanArtifacts(rootPath: string, report: ScanReport, wikiReport: WikiReport, reportMarkdown: string, handoffMarkdown: string): SavedReportArtifacts {
  const dir = join(rootPath, ".desloppify", "reports");
  mkdirSync(dir, { recursive: true });

  const artifacts: SavedReportArtifacts = {
    dir,
    findingsJson: join(dir, "latest.findings.json"),
    reportMarkdown: join(dir, "latest.report.md"),
    wikiJson: join(dir, "latest.wiki.json"),
    handoffMarkdown: join(dir, "latest.handoff.md"),
  };

  writeFileSync(artifacts.findingsJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(artifacts.reportMarkdown, `${reportMarkdown}\n`, "utf8");
  writeFileSync(artifacts.wikiJson, `${JSON.stringify(wikiReport, null, 2)}\n`, "utf8");
  writeFileSync(artifacts.handoffMarkdown, `${handoffMarkdown}\n`, "utf8");

  return artifacts;
}

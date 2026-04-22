import { describe, expect, test } from "bun:test";
import {
  buildNextSessionPrompt,
  buildWikiCloseoutCommand,
  buildWorkflowCommands,
  buildWorkflowNextSteps,
  getScanWorkflowArtifacts,
} from "./scan-workflow";

describe("scan workflow", () => {
  test("returns canonical saved scan artifact paths", () => {
    const artifacts = getScanWorkflowArtifacts("/repo");

    expect(artifacts).toEqual({
      dir: "/repo/.desloppify/reports",
      findingsJson: "/repo/.desloppify/reports/latest.findings.json",
      reportMarkdown: "/repo/.desloppify/reports/latest.report.md",
      wikiJson: "/repo/.desloppify/reports/latest.wiki.json",
      handoffMarkdown: "/repo/.desloppify/reports/latest.handoff.md",
      deltaJson: "/repo/.desloppify/reports/latest.delta.json",
    });
  });

  test("keeps workflow command ids and command strings stable", () => {
    const commands = buildWorkflowCommands({
      rootPath: "/repo",
      project: "desloppify",
      hasDelta: true,
    });

    expect(commands.map((command) => command.id)).toEqual([
      "read-findings",
      "read-delta",
      "prepare-fixes",
      "wiki-closeout",
    ]);
    expect(commands.map((command) => command.command)).toEqual([
      "cat /repo/.desloppify/reports/latest.findings.json",
      "cat /repo/.desloppify/reports/latest.delta.json",
      "desloppify worktrees /repo",
      "wiki closeout desloppify --repo <path> --base <rev>",
    ]);
  });

  test("builds delta-aware next steps and project-aware closeout commands", () => {
    expect(buildWikiCloseoutCommand()).toBe("wiki closeout <project> --repo <path> --base <rev>");
    expect(buildWikiCloseoutCommand("desloppify")).toBe("wiki closeout desloppify --repo <path> --base <rev>");

    expect(buildWorkflowNextSteps({
      rootPath: "/repo",
      project: "desloppify",
      hasDelta: true,
      hasBlockingFindings: true,
      hasNewBlockingFindings: true,
    })).toEqual([
      "Fix newly introduced blocking findings",
      "Review the delta report for new and resolved findings",
      "Update impacted wiki pages from code",
      "wiki closeout desloppify --repo <path> --base <rev>",
    ]);

    expect(buildNextSessionPrompt({
      rootPath: "/repo",
      sliceId: "DESLOPPIFY-044",
      hasNewBlockingFindings: false,
    })).toBe("Continue DESLOPPIFY-044: resolve remaining findings, review the delta report, update wiki pages, and re-run wiki closeout with --base <rev>.");
  });
});

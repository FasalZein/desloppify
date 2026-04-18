import { describe, expect, test } from "bun:test";
import { buildScanReport } from "./report";
import { buildWikiReport, formatWikiHandoffMarkdown } from "./wiki-output";
import type { Issue, ToolStatus } from "./types";

const tools: ToolStatus = {
  knip: false,
  madge: false,
  "ast-grep": false,
  tsc: false,
  eslint: false,
  biome: false,
};

const issues: Issue[] = [
  {
    id: "BLOCKER_RULE",
    category: "dead-code",
    severity: "HIGH",
    tier: 1,
    file: "/repo/src/blocker.ts",
    line: 10,
    message: "blocking issue",
    tool: "grep",
  },
  {
    id: "WARNING_RULE",
    category: "ai-slop",
    severity: "LOW",
    tier: 0,
    file: "/repo/src/warn.ts",
    line: 2,
    message: "warning issue",
    tool: "grep",
  },
];

describe("wiki output", () => {
  test("builds wiki-native review data from canonical report", () => {
    const canonical = buildScanReport("/repo", tools, issues, { name: "js-ts", explicit: true });
    const wiki = buildWikiReport(canonical, { project: "desloppify", sliceId: "DESLOPPIFY-003" });

    expect(wiki.schema).toBe("wiki-forge.review/v1");
    expect(wiki.summary.blocking).toBe(1);
    expect(wiki.actions[0]?.kind).toBe("fix-code");
    expect(wiki.handoff.activeSlice).toBe("DESLOPPIFY-003");
    expect(wiki.nextSteps.at(-1)).toContain("wiki closeout desloppify");
    expect(wiki.nextSteps.at(-1)).toContain("--base <rev>");
    expect(wiki.workflowCommands.map((command) => command.id)).toEqual([
      "read-findings",
      "prepare-fixes",
      "wiki-closeout",
    ]);
    expect(wiki.workflowCommands[0]?.command).toContain("latest.findings.json");
    expect(wiki.workflowCommands[0]?.exec).toEqual({
      command: "cat",
      args: ["/repo/.desloppify/reports/latest.findings.json"],
    });
    expect(wiki.workflowCommands[1]?.command).toContain("desloppify worktrees /repo");
    expect(wiki.workflowCommands[1]?.exec).toEqual({
      command: "desloppify",
      args: ["worktrees", "/repo"],
    });
    expect(wiki.workflowCommands[2]?.command).toContain("wiki closeout desloppify");
    expect(wiki.workflowCommands[2]?.exec).toBeUndefined();
    expect(wiki.handoff.resumeHint).toBeUndefined();
  });

  test("formats a compact markdown handoff", () => {
    const canonical = buildScanReport("/repo", tools, issues, { name: "js-ts", explicit: true });
    const wiki = buildWikiReport(canonical, { project: "desloppify", sliceId: "DESLOPPIFY-003" });
    const markdown = formatWikiHandoffMarkdown(wiki);

    expect(markdown).toContain("# Review handoff — DESLOPPIFY-003");
    expect(markdown).toContain("## Blocking findings");
    expect(markdown).toContain("## Non-blocking findings");
    expect(markdown).toContain("WARNING_RULE at /repo/src/warn.ts:2");
    expect(markdown).toContain("wiki closeout desloppify");
    expect(markdown).toContain("--base <rev>");
  });

  test("lists non-blocking findings even when there are no blockers", () => {
    const canonical = buildScanReport("/repo", tools, [issues[1]!], { name: "js-ts", explicit: true });
    const wiki = buildWikiReport(canonical, { project: "desloppify", sliceId: "DESLOPPIFY-003" });
    const markdown = formatWikiHandoffMarkdown(wiki);

    expect(markdown).toContain("1 non-blocking finding(s). Ready for wiki closeout after page review.");
    expect(markdown).toContain("## Non-blocking findings");
    expect(markdown).toContain("WARNING_RULE at /repo/src/warn.ts:2");
  });
});

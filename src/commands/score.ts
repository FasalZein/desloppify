import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { resolve } from "path";
import type { Issue } from "../types";
import { detectTools } from "../tools";
import { runKnip } from "../analyzers/knip";
import { runMadge } from "../analyzers/madge";
import { runAstGrep } from "../analyzers/ast-grep";
import { runTsc } from "../analyzers/tsc";
import { walkFiles } from "../analyzers/file-walker";
import { runGrepPatternsFromEntries } from "../analyzers/grep-patterns";
import { runFileMetricsFromEntries } from "../analyzers/file-metrics";
import { runGrepExtendedFromEntries } from "../analyzers/grep-extended";
import { runArchitectureProfileFromEntries } from "../analyzers/architecture-profile";
import { buildArchitectureSummary, isArchitectureProfile, resolveArchitectureProfileName } from "../architecture";
import { createSpinner, humanCategory, scanIntro, scanOutro, showScore, showTools, t } from "../ui";

const VERSION = "0.0.1";

/**
 * Scoring system for desloppify.
 *
 * Score = 100 - penalty points.
 * Each issue deducts points based on severity:
 *   CRITICAL: 5 pts
 *   HIGH:     3 pts
 *   MEDIUM:   1 pt
 *   LOW:      0.5 pts
 *
 * Category weights (some categories matter more):
 *   security-slop:           2.0x
 *   weak-types:              1.5x
 *   dead-code:               1.0x
 *   ai-slop:                 0.5x (high volume, low individual impact)
 *   defensive-programming:   1.5x
 *   circular-deps:           1.5x
 *   complexity:              1.0x
 *   duplication:             1.0x
 *   legacy-code:             0.5x
 *   type-fragmentation:      0.5x
 *   inconsistency:           0.5x
 *
 * Grades:
 *   A+: 95-100  |  A: 85-94  |  B: 70-84  |  C: 50-69  |  D: 30-49  |  F: 0-29
 */

const SEVERITY_POINTS: Record<string, number> = {
  CRITICAL: 5,
  HIGH: 3,
  MEDIUM: 1,
  LOW: 0.5,
};

const CATEGORY_WEIGHTS: Record<string, number> = {
  "security-slop": 2.0,
  "runtime-validation": 2.0,
  "async-correctness": 1.5,
  "weak-types": 1.5,
  "defensive-programming": 1.5,
  "circular-deps": 1.5,
  "test-quality": 1.0,
  "dead-code": 1.0,
  "complexity": 1.0,
  "duplication": 1.0,
  "accessibility": 1.0,
  "naming-semantics": 0.5,
  "ai-slop": 0.5,
  "legacy-code": 0.5,
  "type-fragmentation": 0.5,
  "inconsistency": 0.5,
};

function getGrade(score: number): string {
  if (score >= 95) return "A+";
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  if (score >= 30) return "D";
  return "F";
}

// A single category can't nuke more than 20% of the score.
const MAX_CATEGORY_PENALTY = 20;

function calculateScore(issues: Issue[]): {
  score: number;
  grade: string;
  penalty: number;
  categoryScores: Record<string, { count: number; penalty: number; weight: number }>;
} {
  const categoryScores: Record<string, { count: number; penalty: number; weight: number }> = {};

  for (const issue of issues) {
    const sevPoints = SEVERITY_POINTS[issue.severity] ?? 1;
    const catWeight = CATEGORY_WEIGHTS[issue.category] ?? 1.0;
    const penalty = sevPoints * catWeight;

    if (!categoryScores[issue.category]) {
      categoryScores[issue.category] = { count: 0, penalty: 0, weight: catWeight };
    }
    categoryScores[issue.category].count++;
    categoryScores[issue.category].penalty += penalty;
  }

  let totalPenalty = 0;
  for (const data of Object.values(categoryScores)) {
    totalPenalty += Math.min(data.penalty, MAX_CATEGORY_PENALTY);
  }

  const score = Math.max(0, Math.min(100, Math.round(100 - totalPenalty)));
  const grade = getGrade(score);

  return { score, grade, penalty: totalPenalty, categoryScores };
}

export default defineCommand({
  meta: { name: "score", description: "Calculate a weighted quality score for the codebase" },
  args: {
    path: { type: "positional", description: "Path to scan", default: "." },
    json: { type: "boolean", description: "JSON output" },
    architecture: { type: "string", description: "Architecture profile (e.g. modular-monolith)" },
  },
  async run({ args }) {
    const targetPath = resolve(args.path);
    if (args.architecture && !isArchitectureProfile(args.architecture)) {
      throw new Error(`Unknown architecture profile: ${args.architecture}`);
    }

    const architecture = resolveArchitectureProfileName(args.architecture);
    const tools = detectTools();
    const allIssues: Issue[] = [];
    const isJson = args.json;
    const t0 = performance.now();

    if (!isJson) {
      scanIntro(VERSION);
      showTools(tools);
      if (architecture) p.log.info(`Architecture: ${architecture}`);
    }

    const spin = isJson ? null : createSpinner();

    spin?.start("Walking file tree...");
    const entries = await walkFiles(targetPath);

    spin?.message(`Analyzing ${entries.length} files...`);
    allIssues.push(...runGrepPatternsFromEntries(entries));
    allIssues.push(...runGrepExtendedFromEntries(entries));
    allIssues.push(...runFileMetricsFromEntries(entries, { architecture }));
    allIssues.push(...runArchitectureProfileFromEntries(entries, { architecture }));
    spin?.stop(`${entries.length} files scanned — ${allIssues.length} issues from pattern analysis`);

    const tasks: Promise<Issue[]>[] = [];
    if (tools.knip) tasks.push(runKnip(targetPath));
    if (tools.madge) tasks.push(runMadge(targetPath));
    if (tools["ast-grep"]) tasks.push(runAstGrep(targetPath));
    if (tools.tsc) tasks.push(runTsc(targetPath));

    if (tasks.length > 0) {
      const extSpin = isJson ? null : createSpinner();
      extSpin?.start("Running external analyzers...");
      const results = await Promise.all(tasks);
      let extCount = 0;
      for (const issues of results) {
        extCount += issues.length;
        allIssues.push(...issues);
      }
      extSpin?.stop(`External tools done — ${extCount} additional issues`);
    }

    const { score, grade, penalty, categoryScores } = calculateScore(allIssues);

    const architectureSummary = buildArchitectureSummary(architecture, allIssues);

    if (isJson) {
      console.log(JSON.stringify({
        score,
        grade,
        architecture: architectureSummary,
        totalIssues: allIssues.length,
        totalPenalty: Math.round(penalty * 10) / 10,
        categories: categoryScores,
      }, null, 2));
      return;
    }

    showScore(score, grade, allIssues.length, penalty);

    const sorted = Object.entries(categoryScores)
      .sort((a, b) => b[1].penalty - a[1].penalty);

    if (sorted.length > 0) {
      const maxLabel = Math.max(...sorted.map(([cat]) => humanCategory(cat).length));
      const lines = sorted.map(([cat, data]) => {
        const cappedPenalty = Math.min(data.penalty, MAX_CATEGORY_PENALTY);
        const gauge = "█".repeat(Math.max(1, Math.min(15, Math.ceil(cappedPenalty))));
        const rawPenalty = Math.round(data.penalty * 10) / 10;
        const capped = data.penalty > MAX_CATEGORY_PENALTY
          ? ` ${t.dim}(capped ${MAX_CATEGORY_PENALTY})${t.reset}`
          : "";

        return [
          `${t.cream}${humanCategory(cat).padEnd(maxLabel)}${t.reset}`,
          `${String(data.count).padStart(4)} issues`,
          `${String(rawPenalty).padStart(5)} pts`,
          `${t.dim}${data.weight}x${t.reset}`,
          `${t.orange}${gauge}${t.reset}${capped}`,
        ].join("  ");
      });

      p.note(lines.join("\n"), `${t.orange}Weighted categories${t.reset}`);
    }

    if (architectureSummary) {
      const topViolations = Object.entries(architectureSummary.violations)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => `${id}: ${count}`)
        .join("\n");
      p.note([
        `Profile: ${architectureSummary.profile}`,
        `Fit: ${architectureSummary.fitScore}/100`,
        topViolations ? `Top violations:\n${topViolations}` : "Top violations: none",
      ].join("\n\n"), "Architecture");
    }

    p.log.info("Grade scale: A+(95-100) A(85-94) B(70-84) C(50-69) D(30-49) F(0-29)");
    scanOutro(performance.now() - t0, entries.length);
    process.exit(score < 50 ? 1 : 0);
  },
});

export { calculateScore, getGrade, SEVERITY_POINTS, CATEGORY_WEIGHTS };

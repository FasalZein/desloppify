import { defineCommand } from "citty";
import { resolve } from "path";
import type { Issue, Category, ScanReport } from "../types";
import { detectTools } from "../tools";
import { runKnip } from "../analyzers/knip";
import { runMadge } from "../analyzers/madge";
import { runAstGrep } from "../analyzers/ast-grep";
import { runTsc } from "../analyzers/tsc";
import { runGrepPatterns } from "../analyzers/grep-patterns";

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
  "weak-types": 1.5,
  "defensive-programming": 1.5,
  "circular-deps": 1.5,
  "dead-code": 1.0,
  "complexity": 1.0,
  "duplication": 1.0,
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

// Max penalty per category = 25 points (diminishing returns).
// A single category can't nuke more than 25% of the score.
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

  // Apply diminishing returns: cap each category's contribution
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
  },
  async run({ args }) {
    const targetPath = resolve(args.path);
    const tools = detectTools();
    const allIssues: Issue[] = [];

    const tasks: Promise<Issue[]>[] = [];
    tasks.push(runGrepPatterns(targetPath));
    if (tools.knip) tasks.push(runKnip(targetPath));
    if (tools.madge) tasks.push(runMadge(targetPath));
    if (tools["ast-grep"]) tasks.push(runAstGrep(targetPath));
    if (tools.tsc) tasks.push(runTsc(targetPath));

    const results = await Promise.all(tasks);
    for (const issues of results) {
      allIssues.push(...issues);
    }

    const { score, grade, penalty, categoryScores } = calculateScore(allIssues);

    if (args.json) {
      console.log(JSON.stringify({
        score,
        grade,
        totalIssues: allIssues.length,
        totalPenalty: Math.round(penalty * 10) / 10,
        categories: categoryScores,
      }, null, 2));
      return;
    }

    // Pretty output
    const gradeColors: Record<string, string> = {
      "A+": "\x1b[32m", A: "\x1b[32m", B: "\x1b[33m",
      C: "\x1b[33m", D: "\x1b[31m", F: "\x1b[31m",
    };
    const reset = "\x1b[0m";
    const color = gradeColors[grade] ?? "";

    console.log("");
    console.log(`  ${color}╔════════════════════════════╗${reset}`);
    console.log(`  ${color}║  DESLOPPIFY SCORE: ${String(score).padStart(3)}     ║${reset}`);
    console.log(`  ${color}║  GRADE: ${grade.padEnd(18)}  ║${reset}`);
    console.log(`  ${color}╚════════════════════════════╝${reset}`);
    console.log("");
    console.log(`  Total issues: ${allIssues.length}`);
    console.log(`  Total penalty: ${Math.round(penalty * 10) / 10} pts`);
    console.log("");

    // Category breakdown sorted by penalty (worst first)
    const sorted = Object.entries(categoryScores)
      .sort((a, b) => b[1].penalty - a[1].penalty);

    if (sorted.length > 0) {
      console.log("  Category Breakdown:");
      console.log("  ─────────────────────────────────────────────────────");
      const maxCat = Math.max(...sorted.map(([k]) => k.length));
      for (const [cat, data] of sorted) {
        const cappedPenalty = Math.min(data.penalty, MAX_CATEGORY_PENALTY);
        const bar = "█".repeat(Math.min(30, Math.ceil(cappedPenalty)));
        const penaltyStr = Math.round(data.penalty * 10) / 10;
        const cappedStr = data.penalty > MAX_CATEGORY_PENALTY ? ` (capped ${MAX_CATEGORY_PENALTY})` : "";
        console.log(
          `  ${cat.padEnd(maxCat)}  ${String(data.count).padStart(4)} issues  ${String(penaltyStr).padStart(6)} pts  ${data.weight}x  ${bar}${cappedStr}`
        );
      }
      console.log("");
    }

    // Grade scale
    console.log("  Grade scale: A+(95-100) A(85-94) B(70-84) C(50-69) D(30-49) F(0-29)");
    console.log("");

    process.exit(score < 50 ? 1 : 0);
  },
});

export { calculateScore, getGrade, SEVERITY_POINTS, CATEGORY_WEIGHTS };

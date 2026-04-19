import type { Issue } from "./types";

export function getIssuePenalty(issue: Issue): number {
  const sevPoints = SEVERITY_POINTS[issue.severity] ?? 1;
  const catWeight = CATEGORY_WEIGHTS[issue.category] ?? 1.0;
  const ruleWeight = issue.scoreWeight ?? 1.0;
  return sevPoints * catWeight * ruleWeight;
}

export const SEVERITY_POINTS: Record<string, number> = {
  CRITICAL: 5,
  HIGH: 3,
  MEDIUM: 1,
  LOW: 0.5,
};

export const CATEGORY_WEIGHTS: Record<string, number> = {
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

const MAX_CATEGORY_PENALTY = 20;

export function calculateScore(issues: Issue[]): {
  score: number;
  grade: string;
  penalty: number;
  categoryScores: Record<string, { count: number; penalty: number; weight: number }>;
} {
  const categoryScores: Record<string, { count: number; penalty: number; weight: number }> = {};

  for (const issue of issues) {
    const catWeight = CATEGORY_WEIGHTS[issue.category] ?? 1.0;
    const penalty = getIssuePenalty(issue);

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

export { getGrade, MAX_CATEGORY_PENALTY };

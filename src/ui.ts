/**
 * Terminal UI for desloppify — clack-based with burnt orange theme.
 */
import * as p from "@clack/prompts";
import type { Issue } from "./types";

// ── Burnt orange theme (ANSI 256-color) ────────────────────────
const t = {
  orange: "\x1b[38;5;208m",    // burnt orange primary
  amber: "\x1b[38;5;214m",     // warm amber accent
  rust: "\x1b[38;5;166m",      // deep rust for errors
  gold: "\x1b[38;5;220m",      // gold for warnings
  cream: "\x1b[38;5;223m",     // warm cream for body text
  dim: "\x1b[38;5;244m",       // muted gray
  bold: "\x1b[1m",
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
};

// ── Human-readable severity labels ─────────────────────────────
function severityLabel(sev: string): string {
  switch (sev) {
    case "CRITICAL": return `${t.rust}${t.bold}critical${t.reset}`;
    case "HIGH": return `${t.gold}${t.bold}high${t.reset}`;
    case "MEDIUM": return `${t.amber}medium${t.reset}`;
    case "LOW": return `${t.dim}low${t.reset}`;
    default: return sev.toLowerCase();
  }
}

// ── Human-readable rule descriptions (no SNAKE_CASE) ───────────
const HUMAN_RULES: Record<string, string> = {
  BANNER_COMMENT: "AI banner separator",
  NARRATION_COMMENT: "Process narration comment",
  APOLOGETIC_COMMENT: "Apologetic/hedging comment",
  OBVIOUS_JSX_LABEL: "Obvious JSX label comment",
  TODO_REMOVE: "Stale TODO flagged for removal",
  DEMO_PLACEHOLDER: "Demo/placeholder code",
  DEBUG_BREAKPOINT: "Debug breakpoint left in code",
  FAKE_LOADING_DELAY: "Artificial loading delay",
  UNNECESSARY_USECALLBACK: "Unnecessary useCallback wrapper",
  REDUNDANT_BOOLEAN_RETURN: "Redundant boolean-return scaffolding",
  DEPRECATED_ANNOTATION: "Deprecated annotation",
  HEDGING_COMMENT: "Hedging comment",
  HANDWAVY_COMMENT: "Handwavy workaround comment",
  SECTION_LABEL_COMMENT: "Section label comment",
  INSTRUCTIONAL_COMMENT: "Tutorial-style comment",
  STATED_RETURN_COMMENT: "Redundant return comment",
  TRIPLE_NULL_GUARD: "Triple null/undefined guard",
  EXPLICIT_TRUE_COMPARE: "Redundant boolean comparison",
  RETURN_UNDEFINED: "Explicit return undefined",
  PLACEHOLDER_VAR_NAME: "Placeholder variable name",
  LOG_AND_RETHROW: "Log and rethrow pattern",
  LINT_ESCAPE: "Lint suppression",
  ENTRY_EXIT_LOG: "Entry/exit lifecycle log",
  FIXME_HACK_XXX: "FIXME/HACK/XXX marker",
  DEEP_NESTING: "Deeply nested logic",
  NESTED_TERNARY: "Nested ternary chain",
  HARDCODED_SECRET: "Hardcoded secret",
  HARDCODED_URL: "Hardcoded URL",
  SQL_INJECTION: "SQL string concatenation",
  COMMENTED_CODE_BLOCK: "Commented-out code",
  PLACEHOLDER_VALUE: "Placeholder value shipped",
  MIXED_IMPORT_STYLE: "Mixed require/import",
  CALLBACK_STYLE: "Callback-style fs API",
  UNCHECKED_PROMISE: "Empty .then()/.catch()",
  THROW_NON_ERROR: "Thrown non-Error value",
  CATCH_WRAP_NO_CAUSE: "Catch wrap without cause",
  HARDCODED_FAKE_DATA: "Hardcoded data array",
  UNNECESSARY_INTERMEDIATE: "Unnecessary intermediate variable",
  USEMEMO_EMPTY_DEPS: "useMemo with empty deps",
  UNDERSCORE_STATE: "Unused underscore-prefixed state",
  BOOLEAN_FLAG_PARAMS: "3+ boolean parameters",
  REDUNDANT_CAST: "Possibly redundant type cast",
  KEY_INDEX: "Array index as React key",
  CLIENT_GENERATED_ID: "Client-generated ID",
  OR_CASCADE: "Defensive .get() cascade",
  EMPTY_TEST: "Empty test body",
  WEAK_ASSERTION: "Weak assertion",
  ASSERT_TRUE: "Tautological assertion",
  SLEEPY_TEST: "Sleep in test",
  SKIPPED_TEST: "Skipped test",
  SNAPSHOT_OVERUSE: "Snapshot test overuse",
  FOREACH_ASYNC: "async in forEach",
  ASYNC_PROMISE_EXECUTOR: "async Promise executor",
  USEEFFECT_ASYNC: "async useEffect callback",
  REDUNDANT_RETURN_AWAIT: "Redundant return await",
  BARE_ASYNC_MAP: "async map without Promise.all",
  REQUESTS_IN_ASYNC: "Blocking request in async",
  SEQUENTIAL_AWAIT: "Sequential independent awaits",
  CALLBACK_PROMISE_MIX: "Mixed .then() and async/await",
  UNVALIDATED_BODY: "Unvalidated req.body cast",
  JSON_PARSE_CAST: "JSON.parse cast without validation",
  FETCH_RESPONSE_CAST: "Fetch response cast",
  LOCALSTORAGE_CAST: "localStorage cast",
  INTERACTIVE_DIV: "onClick on <div>",
  INTERACTIVE_SPAN: "onClick on <span>",
  IMG_NO_ALT: "Image without alt text",
  MEANINGLESS_ALT: "Meaningless alt text",
  INPUT_NO_LABEL: "Input without label",
  NUMERIC_SUFFIX: "Numeric suffix in name",
  BUILTIN_SHADOW: "Shadows Python builtin",
  EVAL_EXEC: "eval()/exec() usage",
  PICKLE_LOADS: "pickle.load on untrusted data",
  JSON_DEEP_CLONE: "JSON deep clone",
  NOT_IMPLEMENTED_STUB: "Not-implemented JS/TS stub",
  DEAD_FEATURE_FLAG: "Dead feature flag",
  MUTABLE_DEFAULT: "Mutable default argument",
  ITERROWS: "pandas iterrows() performance",
  FULL_LODASH_IMPORT: "Full lodash import",
  MOMENT_IMPORT: "moment.js import",
  TAILWIND_HARDCODED_COLOR: "Hardcoded Tailwind color",
  INLINE_STYLE: "Inline style for layout",
  GOD_FILE: "God file (critical LOC)",
  LARGE_FILE: "Large file (hard LOC threshold)",
  LONG_FILE: "Long file (soft LOC threshold)",
  LAYER_BOUNDARY_VIOLATION: "Route-to-repository boundary violation",
  PRIVATE_MODULE_IMPORT: "Private cross-module import",
  BARREL_FILE: "Barrel export file",
  STAR_REEXPORT: "Wildcard re-export",
  MIXED_CONCERNS: "Route + DB in same file",
  IMPORT_HEAVY: "Too many imports (15+)",
  MONOLITH_ROUTE: "Monolith route file",
  GENERIC_BUCKET_FILE: "Generic bucket file",
  DEBUG_VARIANT_FILE: "Debug variant file",
  SCATTERED_ENV: "Scattered process.env",
  MANY_USESTATE: "Too many useState calls",
  VERB_IN_ROUTE: "Verb in REST route path",
};

function humanRule(id: string): string {
  return HUMAN_RULES[id] ?? id.toLowerCase().replace(/_/g, " ");
}

// ── Category labels ────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  "ai-slop": "AI Slop",
  "dead-code": "Dead Code",
  "weak-types": "Weak Types",
  "circular-deps": "Circular Dependencies",
  "duplication": "Duplication",
  "defensive-programming": "Defensive Programming",
  "legacy-code": "Legacy Code",
  "type-fragmentation": "Type Fragmentation",
  "inconsistency": "Inconsistency",
  "complexity": "Complexity",
  "security-slop": "Security",
  "test-quality": "Test Quality",
  "async-correctness": "Async Correctness",
  "runtime-validation": "Runtime Validation",
  "accessibility": "Accessibility",
  "naming-semantics": "Naming & Semantics",
};

function humanCategory(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat;
}

// ── Public API ─────────────────────────────────────────────────

export function scanIntro(version: string) {
  p.intro(`${t.orange}${t.bold}desloppify${t.reset} ${t.dim}v${version}${t.reset}`);
}

export function scanOutro(elapsed: number, fileCount: number) {
  p.outro(`${t.dim}scanned ${fileCount} files in ${(elapsed / 1000).toFixed(1)}s${t.reset}`);
}

export function createSpinner() {
  return p.spinner();
}

export function showTools(tools: Record<string, boolean>) {
  const active = Object.entries(tools).filter(([, v]) => v).map(([k]) => `${t.green}${k}${t.reset}`);
  const inactive = Object.entries(tools).filter(([, v]) => !v).map(([k]) => k);
  const parts = [active.join(", ")];
  if (inactive.length > 0) parts.push(`${t.dim}(unavailable: ${inactive.join(", ")})${t.reset}`);
  p.log.info(`Tools: ${parts.join("  ")}`);
}

export function showScore(score: number, grade: string, total: number, penalty: number) {
  const gradeCol = score >= 85 ? t.green : score >= 50 ? t.gold : t.rust;
  const filled = Math.max(1, Math.round(score / 10));
  const unfilled = Math.max(0, 10 - filled);
  const scoreGauge = `${gradeCol}${"█".repeat(filled)}${t.dim}${"░".repeat(unfilled)}${t.reset}`;

  let status = `${t.rust}Needs attention${t.reset}`;
  if (total === 0) {
    status = `${t.green}Clean run${t.reset}`;
  } else if (total <= 5) {
    status = `${t.gold}Minor cleanup${t.reset}`;
  }

  const scoreText = [
    `${gradeCol}${t.bold}Current score: ${score}/100  Grade: ${grade}${t.reset}`,
    `${scoreGauge}  ${status}`,
    `${t.dim}${total} issues  |  ${Math.round(penalty * 10) / 10} penalty pts${t.reset}`,
  ].join("\n");

  p.note(scoreText, `${t.orange}${t.bold}Current quality${t.reset}`);
}
export function showNextActions(actions: string[]) {
  if (actions.length === 0) return;
  p.note(actions.map((action, index) => `${index + 1}. ${action}`).join("\n"), `${t.orange}Next actions${t.reset}`);
}

export function showSeveritySummary(summary: { critical: number; high: number; medium: number; low: number }) {
  const total = summary.critical + summary.high + summary.medium + summary.low;
  if (total === 0) {
    p.log.success("No issues found. Your code is clean.");
    return;
  }

  const parts: string[] = [];
  if (summary.critical > 0) parts.push(`${t.rust}${t.bold}${summary.critical} critical${t.reset}`);
  if (summary.high > 0) parts.push(`${t.gold}${t.bold}${summary.high} high${t.reset}`);
  if (summary.medium > 0) parts.push(`${t.amber}${summary.medium} medium${t.reset}`);
  if (summary.low > 0) parts.push(`${t.dim}${summary.low} low${t.reset}`);

  p.log.step(`${t.bold}${total} issues${t.reset}  ${parts.join("  ")}`);
}

export function showCategories(categories: Record<string, { count: number; fixable: number }>) {
  const sorted = Object.entries(categories).sort((a, b) => b[1].count - a[1].count);
  if (sorted.length === 0) return;

  const maxCount = Math.max(...sorted.map(([, v]) => v.count));
  const lines: string[] = [];

  for (const [cat, data] of sorted) {
    const gauge = "█".repeat(Math.max(1, Math.round((data.count / maxCount) * 15)));
    const gaugeColor = data.count > 20 ? t.rust : data.count > 5 ? t.gold : t.orange;
    const fixStr = data.fixable > 0 ? `  ${t.green}${data.fixable} fixable${t.reset}` : "";
    lines.push(
      `${t.cream}${humanCategory(cat).padEnd(24)}${t.reset} ${String(data.count).padStart(4)}${fixStr}  ${gaugeColor}${gauge}${t.reset}`
    );
  }

  p.note(lines.join("\n"), `${t.orange}Categories${t.reset}`);
}

export function showIssues(issues: Issue[], { limit = 15, groupBy = "severity" }: { limit?: number; groupBy?: string } = {}) {
  if (issues.length === 0) return;

  if (groupBy === "category") {
    showIssuesByCategory(issues, limit);
  } else {
    showIssuesBySeverity(issues, limit);
  }
}

function showIssuesBySeverity(issues: Issue[], limit: number) {
  for (const sev of ["CRITICAL", "HIGH", "MEDIUM", "LOW"]) {
    const sevIssues = issues.filter((i) => i.severity === sev);
    if (sevIssues.length === 0) continue;

    const showAll = sev === "CRITICAL" || sev === "HIGH";
    const shown = sevIssues.slice(0, showAll ? 50 : limit);
    const lines: string[] = [];

    for (const issue of shown) {
      const relFile = issue.file.replace(process.cwd() + "/", "");
      lines.push(`${severityLabel(sev)}  ${t.cream}${humanRule(issue.id)}${t.reset}`);
      lines.push(`  ${t.dim}${relFile}:${issue.line}${t.reset}`);
      lines.push(`  ${issue.message}`);
      if (issue.fix) lines.push(`  ${t.green}→ ${issue.fix}${t.reset}`);
    }

    if (sevIssues.length > shown.length) {
      lines.push(`${t.dim}  ... and ${sevIssues.length - shown.length} more ${sev.toLowerCase()} issues${t.reset}`);
    }

    const logFn = sev === "CRITICAL" ? p.log.error : sev === "HIGH" ? p.log.warn : p.log.message;
    logFn(lines.join("\n"));
  }
}

function showIssuesByCategory(issues: Issue[], limit: number) {
  const cats = new Map<string, Issue[]>();
  for (const issue of issues) {
    if (!cats.has(issue.category)) cats.set(issue.category, []);
    cats.get(issue.category)!.push(issue);
  }

  for (const [cat, catIssues] of [...cats.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const shown = catIssues.slice(0, limit);
    const lines: string[] = [];

    for (const issue of shown) {
      const relFile = issue.file.replace(process.cwd() + "/", "");
      lines.push(`${severityLabel(issue.severity)}  ${t.cream}${humanRule(issue.id)}${t.reset}`);
      lines.push(`  ${t.dim}${relFile}:${issue.line}${t.reset}  ${issue.message}`);
    }

    if (catIssues.length > shown.length) {
      lines.push(`${t.dim}  ... and ${catIssues.length - shown.length} more${t.reset}`);
    }

    p.note(lines.join("\n"), `${t.orange}${humanCategory(cat)}${t.reset} ${t.dim}(${catIssues.length})${t.reset}`);
  }
}

export { t, humanRule, humanCategory };

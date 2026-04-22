import type { Issue } from "../types";

type IssueMeta = Pick<Issue, "category" | "severity" | "tier"> & { fix?: string };

function withDefault(meta: Partial<IssueMeta>, fallback: IssueMeta): IssueMeta {
  return {
    category: meta.category ?? fallback.category,
    severity: meta.severity ?? fallback.severity,
    tier: meta.tier ?? fallback.tier,
    fix: meta.fix ?? fallback.fix,
  };
}

export function getJsTsLintMeta(ruleId: string): IssueMeta {
  const rule = ruleId.toLowerCase();
  const fallback: IssueMeta = { category: "inconsistency", severity: "MEDIUM", tier: 1 };

  if (rule.includes("unused") || rule.includes("no-unused")) {
    return withDefault({ category: "dead-code", severity: "HIGH", tier: 3, fix: "Remove unused code or wire it into real usage" }, fallback);
  }
  if (rule.includes("explicit-any") || rule.includes("noexplicitany") || rule.includes("unsafe")) {
    return withDefault({ category: "weak-types", severity: "HIGH", tier: 3, fix: "Replace broad or unsafe typing with concrete types" }, fallback);
  }
  if (rule.includes("no-console") || rule.includes("noconsole") || rule.includes("no-console-log")) {
    return withDefault({ category: "ai-slop", severity: "LOW", tier: 1, fix: "Remove console usage or replace it with structured logging" }, fallback);
  }
  if (rule.includes("debugger") || rule.includes("debuggerstatement")) {
    return withDefault({ category: "ai-slop", severity: "HIGH", tier: 3, fix: "Remove the debugger statement" }, fallback);
  }
  if (rule.includes("no-empty") || rule.includes("useless-catch") || rule.includes("nocatchassign") || rule.includes("no-empty-blocks")) {
    return withDefault({ category: "defensive-programming", severity: "HIGH", tier: 2, fix: "Handle the error explicitly instead of swallowing it" }, fallback);
  }
  if (rule.includes("no-await-in-loop") || rule.includes("awaitinloop")) {
    return withDefault({ category: "async-correctness", severity: "MEDIUM", tier: 1, fix: "Batch async work with Promise.all or restructure the loop" }, fallback);
  }
  if (rule.includes("duplicate") || rule.includes("dedup")) {
    return withDefault({ category: "duplication", severity: "MEDIUM", tier: 1 }, fallback);
  }
  if (rule.includes("complex") || rule.includes("max-depth") || rule.includes("max-lines") || rule.includes("max-params")) {
    return withDefault({ category: "complexity", severity: "MEDIUM", tier: 1 }, fallback);
  }

  return fallback;
}

export function getPythonLintMeta(ruleId: string): IssueMeta {
  const rule = ruleId.toUpperCase();
  const fallback: IssueMeta = { category: "inconsistency", severity: "MEDIUM", tier: 1 };

  if (["F401", "F841", "ARG001", "ARG002"].some((code) => rule.startsWith(code))) {
    return withDefault({ category: "dead-code", severity: "MEDIUM", tier: 2, fix: "Remove the unused import, variable, or argument" }, fallback);
  }
  if (rule.startsWith("T201")) {
    return withDefault({ category: "ai-slop", severity: "LOW", tier: 1, fix: "Replace print debugging with proper logging or remove it" }, fallback);
  }
  if (rule.startsWith("E722") || rule.startsWith("BLE001")) {
    return withDefault({ category: "defensive-programming", severity: "HIGH", tier: 2, fix: "Catch a narrower exception type and handle it explicitly" }, fallback);
  }
  if (rule.startsWith("S") || rule.startsWith("B")) {
    return withDefault({ category: "security-slop", severity: "HIGH", tier: 1 }, fallback);
  }
  if (rule.startsWith("ANN") || rule.startsWith("UP") || rule.startsWith("TC")) {
    return withDefault({ category: "weak-types", severity: "MEDIUM", tier: 1 }, fallback);
  }

  return fallback;
}

export function getGoLintMeta(ruleId: string): IssueMeta {
  const rule = ruleId.toLowerCase();
  const fallback: IssueMeta = { category: "inconsistency", severity: "MEDIUM", tier: 1 };

  if (rule.includes("unused") || rule.includes("deadcode") || rule.includes("ineffassign")) {
    return withDefault({ category: "dead-code", severity: "MEDIUM", tier: 2, fix: "Remove the unused symbol or wire it into real usage" }, fallback);
  }
  if (rule.includes("printf") || rule.includes("slog") || rule.includes("govet")) {
    return withDefault({ category: "defensive-programming", severity: "HIGH", tier: 1 }, fallback);
  }
  if (rule.includes("errcheck") || rule.includes("errorlint") || rule.includes("wrapcheck")) {
    return withDefault({ category: "defensive-programming", severity: "HIGH", tier: 1, fix: "Handle or wrap the error explicitly" }, fallback);
  }
  if (rule.includes("gosec") || rule.includes("security")) {
    return withDefault({ category: "security-slop", severity: "HIGH", tier: 1 }, fallback);
  }
  if (rule.includes("cyclop") || rule.includes("funlen") || rule.includes("gocognit")) {
    return withDefault({ category: "complexity", severity: "MEDIUM", tier: 1 }, fallback);
  }

  return fallback;
}

export function getRubyLintMeta(ruleId: string): IssueMeta {
  const rule = ruleId.toLowerCase();
  const fallback: IssueMeta = { category: "inconsistency", severity: "MEDIUM", tier: 1 };

  if (rule.includes("lint/debugger") || rule.includes("puts") || rule.includes("print")) {
    return withDefault({ category: "ai-slop", severity: "LOW", tier: 1, fix: "Remove debug output before shipping" }, fallback);
  }
  if (rule.includes("lint/rescueexception") || rule.includes("lint/suppressexception") || rule.includes("style/rescuestandarderror")) {
    return withDefault({ category: "defensive-programming", severity: "HIGH", tier: 1, fix: "Rescue a specific exception type and handle it explicitly" }, fallback);
  }
  if (rule.includes("lint/unused") || rule.includes("lint/useless") || rule.includes("lint/shadowingouterlocalvariable")) {
    return withDefault({ category: "dead-code", severity: "MEDIUM", tier: 1 }, fallback);
  }
  if (rule.includes("security")) {
    return withDefault({ category: "security-slop", severity: "HIGH", tier: 1 }, fallback);
  }
  if (rule.includes("metrics/abcsize") || rule.includes("metrics/methodlength") || rule.includes("metrics/blocklength") || rule.includes("metrics/cyclomaticcomplexity")) {
    return withDefault({ category: "complexity", severity: "MEDIUM", tier: 1 }, fallback);
  }

  return fallback;
}

export function getRustLintMeta(ruleId: string): IssueMeta {
  const rule = ruleId.toLowerCase();
  const fallback: IssueMeta = { category: "inconsistency", severity: "MEDIUM", tier: 1 };

  if (rule.includes("unwrap") || rule.includes("expect") || rule.includes("panic") || rule.includes("todo")) {
    return withDefault({ category: "defensive-programming", severity: "HIGH", tier: 2, fix: "Handle the error path explicitly instead of panicking" }, fallback);
  }
  if (rule.includes("dbg") || rule.includes("print") || rule.includes("println")) {
    return withDefault({ category: "ai-slop", severity: "LOW", tier: 1, fix: "Remove debug logging before shipping" }, fallback);
  }
  if (rule.includes("unused")) {
    return withDefault({ category: "dead-code", severity: "MEDIUM", tier: 2 }, fallback);
  }

  return fallback;
}

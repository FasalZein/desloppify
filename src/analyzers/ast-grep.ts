import type { Issue } from "../types";
import { resolve } from "path";
import { loadIgnorePatterns, isFileIgnored } from "../ignore";

const RULES_DIR = resolve(import.meta.dir, "../../src/rules");

export async function runAstGrep(targetPath: string): Promise<Issue[]> {
  const sgCmd = Bun.which("sg") ? "sg" : "ast-grep";
  const ignorePatterns = await loadIgnorePatterns(targetPath);

  const result = Bun.spawnSync(
    [sgCmd, "scan", "--rule", RULES_DIR, targetPath, "--json=stream"],
    { stdout: "pipe", stderr: "pipe", timeout: 60_000 }
  );

  if (result.exitCode !== 0 && result.exitCode !== 1) {
    return [];
  }

  const stdout = result.stdout.toString().trim();
  if (!stdout) return [];

  const issues: Issue[] = [];

  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const match = JSON.parse(line);
      const ruleId: string = match.ruleId ?? match.rule_id ?? "UNKNOWN";
      const meta = RULE_META[ruleId];
      if (!meta) continue;

      const file = match.file ?? match.path ?? "";

      // Skip files matching .desloppifyignore
      if (isFileIgnored(file, targetPath, ignorePatterns)) continue;

      issues.push({
        id: ruleId,
        category: meta.category,
        severity: meta.severity,
        tier: meta.tier,
        file,
        line: match.range?.start?.line ?? match.start?.line ?? 0,
        message: match.message ?? meta.message,
        fix: meta.fix,
        tool: "ast-grep",
      });
    } catch {
      // Non-JSON line from ast-grep, skip
    }
  }

  return issues;
}

interface RuleMeta {
  category: Issue["category"];
  severity: Issue["severity"];
  tier: Issue["tier"];
  message: string;
  fix?: string;
}

const RULE_META: Record<string, RuleMeta> = {
  EMPTY_CATCH: {
    category: "defensive-programming",
    severity: "HIGH",
    tier: 2,
    message: "Empty catch block swallows errors silently",
    fix: "Remove try-catch or add meaningful error handling",
  },
  CATCH_RETURN_DEFAULT: {
    category: "defensive-programming",
    severity: "HIGH",
    tier: 2,
    message: "Catch block returns default value, hiding errors",
    fix: "Let the error propagate or handle it meaningfully",
  },
  CATCH_LOG_CONTINUE: {
    category: "defensive-programming",
    severity: "MEDIUM",
    tier: 2,
    message: "Catch block logs and continues — error is swallowed",
    fix: "Re-throw after logging, or handle the error properly",
  },
  ANY_TYPE: {
    category: "weak-types",
    severity: "HIGH",
    tier: 3,
    message: "Explicit 'any' type bypasses type safety",
    fix: "Replace with the correct specific type",
  },
  AS_ANY_CAST: {
    category: "weak-types",
    severity: "CRITICAL",
    tier: 3,
    message: "'as any' cast hides type mismatch",
    fix: "Fix the underlying type mismatch instead of casting",
  },
  OBJECT_TYPE: {
    category: "weak-types",
    severity: "MEDIUM",
    tier: 3,
    message: "'object' type is too broad",
    fix: "Use a specific interface or Record type",
  },
  FUNCTION_TYPE: {
    category: "weak-types",
    severity: "MEDIUM",
    tier: 3,
    message: "'Function' type is untyped — use a specific signature",
    fix: "Replace with typed function signature: (args: T) => R",
  },
  BANNER_COMMENT: {
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "ASCII banner separator comment — visual noise",
    fix: "Remove the banner comment",
  },
  CONSOLE_LOG: {
    category: "ai-slop",
    severity: "MEDIUM",
    tier: 1,
    message: "console.log left in production code",
    fix: "Remove or replace with proper logging",
  },
  NOOP_CALLBACK: {
    category: "defensive-programming",
    severity: "MEDIUM",
    tier: 2,
    message: "No-op callback fallback — hides missing handler",
    fix: "Make the callback required or handle absence explicitly",
  },
  DEEP_OPTIONAL_CHAIN: {
    category: "defensive-programming",
    severity: "MEDIUM",
    tier: 0,
    message: "Optional chain 3+ levels deep — data model may be wrong",
  },
  LONG_FUNCTION: {
    category: "complexity",
    severity: "MEDIUM",
    tier: 0,
    message: "Function exceeds 50 lines",
  },
  DEEP_NESTING: {
    category: "complexity",
    severity: "HIGH",
    tier: 0,
    message: "Conditional nesting 3+ levels deep",
    fix: "Extract inner blocks or use early returns",
  },
  TODO_REMOVE: {
    category: "legacy-code",
    severity: "LOW",
    tier: 1,
    message: "TODO/FIXME comment with removal instruction",
    fix: "Resolve the TODO or remove the dead note",
  },
  DEPRECATED_ANNOTATION: {
    category: "legacy-code",
    severity: "MEDIUM",
    tier: 2,
    message: "@deprecated annotation — this code should be removed",
    fix: "Remove the deprecated code and update callers",
  },
  // Python rules
  BARE_EXCEPT: {
    category: "defensive-programming",
    severity: "HIGH",
    tier: 2,
    message: "Bare except catches everything including KeyboardInterrupt",
    fix: "Specify the exception type: except ValueError, except Exception",
  },
  PASS_STUB: {
    category: "ai-slop",
    severity: "MEDIUM",
    tier: 0,
    message: "Pass-only function body — likely a stub never implemented",
  },
  PRINT_STATEMENT: {
    category: "ai-slop",
    severity: "MEDIUM",
    tier: 1,
    message: "print() left in production code",
    fix: "Remove or replace with logging module",
  },
  // Rust rules
  UNWRAP_CALL: {
    category: "defensive-programming",
    severity: "MEDIUM",
    tier: 0,
    message: ".unwrap() can panic at runtime",
    fix: "Use ? operator or match/if-let for error handling",
  },
  EXPECT_CALL: {
    category: "defensive-programming",
    severity: "LOW",
    tier: 0,
    message: ".expect() can panic — prefer proper error handling",
  },
  TODO_MACRO: {
    category: "legacy-code",
    severity: "HIGH",
    tier: 0,
    message: "todo!()/unimplemented!() macro left in code",
    fix: "Implement the missing logic or remove",
  },
};

import type { Issue, Category, Severity, Tier } from "../types";
import { Glob } from "bun";

interface GrepRule {
  id: string;
  pattern: RegExp;
  category: Category;
  severity: Severity;
  tier: Tier;
  message: string;
  fix?: string;
}

const RULES: GrepRule[] = [
  // ai-slop: banner comments
  {
    id: "BANNER_COMMENT",
    pattern: /^[\s]*(\/\/|#)\s*[─═━─\-=]{10,}/,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "ASCII banner separator — visual noise from LLM generation",
    fix: "Remove the banner line",
  },
  // ai-slop: narration comments
  {
    id: "NARRATION_COMMENT",
    pattern: /\/\/\s*(First,?\s+(we|let's)|Now\s+(we|let's)|Next,?\s+(we|let's)|Step\s+\d+)/i,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "Process narration comment — code isn't a story",
    fix: "Remove the narration comment",
  },
  // ai-slop: apologetic comments
  {
    id: "APOLOGETIC_COMMENT",
    pattern: /\/\/\s*(Note:\s*you\s+may|Feel free to|You might want to|TODO:\s*consider)/i,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "Apologetic/suggestive comment — decide and act, don't hedge",
    fix: "Remove the comment or implement the suggestion",
  },
  // ai-slop: obvious JSX labels
  {
    id: "OBVIOUS_JSX_LABEL",
    pattern: /\{\/\*\s*(Header|Footer|Sidebar|Main content|Navigation|Content|Body|Wrapper)\s*\*\/\}/i,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "JSX comment labels the obvious — the component tag is the label",
    fix: "Remove the comment",
  },
  // legacy: TODO/FIXME with temporal references
  {
    id: "TODO_REMOVE",
    pattern: /\/\/\s*(TODO|FIXME|HACK|XXX)\s*:?\s*.*(remove|delete|clean\s*up|temporary|temp\b|replace|migrate|deprecated)/i,
    category: "legacy-code",
    severity: "LOW",
    tier: 1,
    message: "TODO comment flagged for removal or migration",
    fix: "Resolve the TODO or remove it",
  },
  // ai-slop: demo/placeholder markers
  {
    id: "DEMO_PLACEHOLDER",
    pattern: /^\s*\/\/\s*(for demo|placeholder|mock data|sample data|dummy data|fake data|wire.*real.*api|todo.*wire|todo.*replace.*real)/i,
    category: "ai-slop",
    severity: "MEDIUM",
    tier: 1,
    message: "Demo/placeholder code flagged by comment",
    fix: "Replace with real implementation or remove",
  },
  // legacy: deprecated annotations
  {
    id: "DEPRECATED_ANNOTATION",
    pattern: /^\s*(\*\s*)?@deprecated\b/,
    category: "legacy-code",
    severity: "MEDIUM",
    tier: 2,
    message: "Deprecated annotation — this code should be removed",
    fix: "Remove and update callers",
  },
  // ai-slop: hedging comments
  {
    id: "HEDGING_COMMENT",
    pattern: /(\/\/|#)\s*(should work|hopefully|might need|in theory|this may|ideally|this seems to)/i,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "Hedging comment — LLM uncertainty leaked into code",
    fix: "Remove the hedging comment or fix the uncertainty",
  },
  // ai-slop: section label comments
  {
    id: "SECTION_LABEL_COMMENT",
    pattern: /^\s*(\/\/|#)\s*(Setup|Initialization|Cleanup|Teardown|Main logic|Business logic|Helper functions|Utility functions|Constants|Imports)\s*$/i,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "Section label comment — fake structure in a flat file",
    fix: "Remove or extract into a real module",
  },
  // ai-slop: instructional comments
  {
    id: "INSTRUCTIONAL_COMMENT",
    pattern: /(\/\/|#)\s*(Make sure to|Don't forget|Remember to|Be sure to|Be careful|Important:?\s+always)/i,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "Tutorial voice in production code",
    fix: "Remove the instructional comment",
  },
  // ai-slop: stated return comments
  {
    id: "STATED_RETURN_COMMENT",
    pattern: /\/\/\s*[Rr]eturn(s|ing)?\s+(the|a|an)\s+\w+/,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "Comment narrates the return value — the code already says this",
    fix: "Remove the comment",
  },
  // ai-slop: triple null guard
  {
    id: "TRIPLE_NULL_GUARD",
    pattern: /!==?\s*(null|undefined)\s*&&\s*\w+\s*!==?\s*(null|undefined)\s*&&\s*\w+\s*!==?\s*['"]/,
    category: "ai-slop",
    severity: "MEDIUM",
    tier: 2,
    message: "Triple null/undefined/empty guard — use ?? or != null",
    fix: "Simplify to a single nullish check",
  },
  // ai-slop: explicit true/false comparison
  {
    id: "EXPLICIT_TRUE_COMPARE",
    pattern: /===?\s*(true|false)\b/,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "Redundant boolean comparison — just use the value directly",
    fix: "Remove === true or negate for === false",
  },
  // ai-slop: return undefined explicitly
  {
    id: "RETURN_UNDEFINED",
    pattern: /^\s*return\s+undefined\s*;/,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "Explicit return undefined — just return;",
    fix: "Replace with bare return;",
  },
  // ai-slop: placeholder variable names
  {
    id: "PLACEHOLDER_VAR_NAME",
    pattern: /\b(data[2-9]|result[2-9]|temp\d+|foo\d*|bar\d*|baz\d*|myVar|someVar|testData)\b\s*[=:]/,
    category: "ai-slop",
    severity: "MEDIUM",
    tier: 0,
    message: "Placeholder variable name — rename to something meaningful",
  },
  // defensive: log and rethrow
  {
    id: "LOG_AND_RETHROW",
    pattern: /console\.(error|log|warn)\s*\(.*\);\s*\n\s*throw\b/,
    category: "defensive-programming",
    severity: "HIGH",
    tier: 2,
    message: "Catch-log-rethrow adds no value — let the error propagate",
    fix: "Remove the catch block or handle the error meaningfully",
  },
  // ai-slop: lint escape
  {
    id: "LINT_ESCAPE",
    pattern: /(eslint-disable|@ts-ignore|@ts-nocheck|\/\/\s*noqa|#\s*type:\s*ignore)/,
    category: "ai-slop",
    severity: "MEDIUM",
    tier: 0,
    message: "Lint suppression — fix the underlying issue instead",
  },
  // ai-slop: entry/exit logging
  {
    id: "ENTRY_EXIT_LOG",
    pattern: /console\.(log|debug)\s*\(\s*['"`](Entering|Exiting|Called|Start(ing|ed)?|End(ing|ed)?|Leaving)\b/i,
    category: "ai-slop",
    severity: "MEDIUM",
    tier: 1,
    message: "Function lifecycle logging — debugging residue",
    fix: "Remove the entry/exit log statement",
  },
  // legacy: FIXME/HACK/XXX (stronger signal than TODO)
  {
    id: "FIXME_HACK_XXX",
    pattern: /^\s*(\/\/|#)\s*(FIXME|HACK|XXX)\b/,
    category: "legacy-code",
    severity: "MEDIUM",
    tier: 0,
    message: "FIXME/HACK/XXX marker — known bad code left in",
  },
  // complexity: deeply nested callbacks
  {
    id: "DEEP_NESTING",
    pattern: /^(\s{12,}|\t{3,})(if|else|for|while|switch)\s*\(/,
    category: "complexity",
    severity: "HIGH",
    tier: 0,
    message: "Deeply nested conditional — hard to follow",
    fix: "Extract to function or use early returns",
  },
  // complexity: nested ternary chains
  {
    id: "NESTED_TERNARY",
    pattern: /\?[^:]+\?[^:]+:/,
    category: "complexity",
    severity: "MEDIUM",
    tier: 0,
    message: "Nested ternary chain — use if/else for readability",
  },
];

export async function runGrepPatterns(targetPath: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  const glob = new Glob("**/*.{ts,tsx,js,jsx,py,rs,go,java,kt,rb,swift,c,cpp,cs}");

  for await (const filePath of glob.scan({
    cwd: targetPath,
    absolute: true,
    dot: false,
  })) {
    // Skip node_modules, .git, dist, build
    if (/node_modules|\.git\/|\/dist\/|\/build\/|\.min\./.test(filePath)) continue;

    try {
      const file = Bun.file(filePath);
      const content = await file.text();
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const rule of RULES) {
          if (rule.pattern.test(line)) {
            issues.push({
              id: rule.id,
              category: rule.category,
              severity: rule.severity,
              tier: rule.tier,
              file: filePath,
              line: i + 1,
              message: rule.message,
              fix: rule.fix,
              tool: "grep",
            });
          }
        }
      }
    } catch {
      // Unreadable file, skip
    }
  }

  return issues;
}

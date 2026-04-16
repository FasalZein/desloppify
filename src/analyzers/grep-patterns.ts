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
    pattern: /\/\/\s*.*(for demo|placeholder|mock data|sample data|dummy data|fake data|wire.*real.*api)/i,
    category: "ai-slop",
    severity: "MEDIUM",
    tier: 1,
    message: "Demo/placeholder code flagged by comment",
    fix: "Replace with real implementation or remove",
  },
  // legacy: deprecated annotations
  {
    id: "DEPRECATED_ANNOTATION",
    pattern: /@deprecated/,
    category: "legacy-code",
    severity: "MEDIUM",
    tier: 2,
    message: "@deprecated code still present",
    fix: "Remove and update callers",
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
];

export async function runGrepPatterns(targetPath: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  const glob = new Glob("**/*.{ts,tsx,js,jsx,py}");

  for await (const filePath of glob.scan({
    cwd: targetPath,
    absolute: true,
    dot: false,
  })) {
    // Skip node_modules, .git, dist, build, and desloppify's own source
    if (/node_modules|\.git\/|\/dist\/|\/build\/|\.min\.|desloppify\/src\//.test(filePath)) continue;

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

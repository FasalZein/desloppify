import type { GrepPatternRuleDefinition, GrepPatternRuleDescriptions } from "./shared";

export const SECURITY_SLOP_GREP_PATTERN_RULES: GrepPatternRuleDefinition[] = [
  {
    id: "HARDCODED_SECRET",
    pattern: /\b(password|secret|api_key|apiKey|token|auth)\s*[:=]\s*["'][^"']{8,}["']/,
    category: "security-slop",
    severity: "CRITICAL",
    tier: 0,
    message: "Hardcoded secret — move to environment variable",
    skipTest: true,
  },
  {
    id: "HARDCODED_URL",
    pattern: /["'](https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0):\d+|https?:\/\/api\.\w+\.com)[^"']*["']/,
    category: "security-slop",
    severity: "MEDIUM",
    tier: 0,
    message: "Hardcoded URL — use environment variable or config",
  },
  {
    id: "SQL_INJECTION",
    pattern: /["'`](SELECT|INSERT|UPDATE|DELETE)\s+.*["'`]\s*\+\s*\w+/i,
    category: "security-slop",
    severity: "CRITICAL",
    tier: 0,
    message: "SQL string concatenation — use parameterized queries",
  },
  {
    id: "CLIENT_GENERATED_ID",
    pattern: /`\w+_\$\{Date\.now\(\)\}_\$\{Math\.random\(/,
    category: "security-slop",
    severity: "MEDIUM",
    tier: 0,
    message: "Client-generated ID — let the server generate IDs for persisted records",
  },
];

export const SECURITY_SLOP_GREP_PATTERN_DESCRIPTIONS: GrepPatternRuleDescriptions = {
  HARDCODED_SECRET: "Hardcoded password/secret/key/token",
  HARDCODED_URL: "Hardcoded localhost or API URL",
  SQL_INJECTION: "SQL string concatenation — use params",
  CLIENT_GENERATED_ID: "Client-generated ID for server records",
};

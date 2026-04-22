import type { Issue, Severity } from "./types";

export const ARCHITECTURE_PROFILES = {
  "modular-monolith": {
    name: "modular-monolith",
    description: "DDD-lite modules + VSA routes + curated public index.ts only",
    aliases: ["gii-mvp"],
    loc: {
      default: { soft: 300, hard: 500, god: 800 },
      routeSlice: { soft: 150, hard: 250, god: 400 },
    },
    allowCuratedIndexBarrels: true,
    allowRouteRegistrarIndex: true,
    ruleIds: [
      "LONG_FILE",
      "LARGE_FILE",
      "GOD_FILE",
      "IMPORT_HEAVY",
      "GENERIC_BUCKET_FILE",
      "MIXED_CONCERNS",
      "MONOLITH_ROUTE",
      "LAYER_BOUNDARY_VIOLATION",
      "PRIVATE_MODULE_IMPORT",
      "BARREL_FILE",
      "STAR_REEXPORT",
      "SCATTERED_ENV",
      "CIRCULAR_IMPORT",
    ],
    exemptionsApplied: [
      "packages/*/index.ts curated public API",
      "routes/**/index.ts registrar-only",
    ],
  },
} as const;

export type ArchitectureProfileName = keyof typeof ARCHITECTURE_PROFILES;
type ArchitectureProfile = (typeof ARCHITECTURE_PROFILES)[ArchitectureProfileName];

const ARCHITECTURE_ALIASES = new Map<string, ArchitectureProfileName>([
  ["gii-mvp", "modular-monolith"],
]);

export function resolveArchitectureProfileName(value?: string | null): ArchitectureProfileName | undefined {
  if (!value) return undefined;
  if (value in ARCHITECTURE_PROFILES) return value as ArchitectureProfileName;
  return ARCHITECTURE_ALIASES.get(value);
}

export function isArchitectureProfile(value: string): boolean {
  return Boolean(resolveArchitectureProfileName(value));
}

export function getArchitectureProfile(value?: string | null): ArchitectureProfile | undefined {
  const name = resolveArchitectureProfileName(value);
  if (!name) return undefined;
  return ARCHITECTURE_PROFILES[name];
}

const SEVERITY_POINTS: Record<Severity, number> = {
  CRITICAL: 20,
  HIGH: 12,
  MEDIUM: 6,
  LOW: 3,
};

export function buildArchitectureSummary(value: string | undefined, issues: Issue[]) {
  const profile = getArchitectureProfile(value);
  if (!profile) return undefined;

  const ruleIds = new Set<string>(profile.ruleIds);
  const relevant = issues.filter((issue) => ruleIds.has(issue.id));
  const violations: Record<string, number> = {};
  let penalty = 0;

  for (const issue of relevant) {
    violations[issue.id] = (violations[issue.id] ?? 0) + 1;
    penalty += SEVERITY_POINTS[issue.severity] ?? 0;
  }

  return {
    profile: profile.name,
    fitScore: Math.max(0, 100 - penalty),
    violations,
    exemptionsApplied: profile.exemptionsApplied,
  };
}

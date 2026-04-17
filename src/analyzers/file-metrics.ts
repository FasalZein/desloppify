import { getArchitectureProfile, type ArchitectureProfileName } from "../architecture";
import type { Issue } from "../types";
import type { FileEntry } from "./file-walker";

interface FileMetricsOptions {
  architecture?: ArchitectureProfileName;
}

interface LocLimits {
  soft: number;
  hard: number;
  god: number;
}

type LocBucket =
  | "default"
  | "route"
  | "route-support"
  | "ui"
  | "dense-ui"
  | "app-shell"
  | "test"
  | "integration-test"
  | "script";

const DEFAULT_LIMITS: LocLimits = {
  soft: 300,
  hard: 500,
  god: 800,
};

const UI_LIMITS: LocLimits = {
  soft: 300,
  hard: 500,
  god: 750,
};

const DENSE_UI_LIMITS: LocLimits = {
  soft: 400,
  hard: 650,
  god: 950,
};

const APP_SHELL_LIMITS: LocLimits = {
  soft: 400,
  hard: 650,
  god: 950,
};

const TEST_LIMITS: LocLimits = {
  soft: 600,
  hard: 1000,
  god: 1600,
};

const INTEGRATION_TEST_LIMITS: LocLimits = {
  soft: 900,
  hard: 1500,
  god: 2400,
};

const SCRIPT_LIMITS: LocLimits = {
  soft: 500,
  hard: 800,
  god: 1300,
};

const ROUTE_SUPPORT_LIMITS: LocLimits = {
  soft: 350,
  hard: 550,
  god: 850,
};

const BUCKET_BASE_LIMITS: Record<LocBucket, LocLimits> = {
  default: DEFAULT_LIMITS,
  route: DEFAULT_LIMITS,
  "route-support": ROUTE_SUPPORT_LIMITS,
  ui: UI_LIMITS,
  "dense-ui": DENSE_UI_LIMITS,
  "app-shell": APP_SHELL_LIMITS,
  test: TEST_LIMITS,
  "integration-test": INTEGRATION_TEST_LIMITS,
  script: SCRIPT_LIMITS,
};

const BUCKET_MAX_LIFT_RATIO: Record<LocBucket, number> = {
  default: 1.25,
  route: 1.05,
  "route-support": 1.2,
  ui: 1.3,
  "dense-ui": 1.45,
  "app-shell": 1.45,
  test: 1.5,
  "integration-test": 1.6,
  script: 1.4,
};

const MIN_BUCKET_SIZE_FOR_DYNAMIC_LIMITS = 5;

interface FileContext {
  entry: FileEntry;
  filePath: string;
  fileName: string;
  extension: string;
  cohortKey: string;
  lines: string[];
  loc: number;
  isGenerated: boolean;
  isRouteFile: boolean;
  isRouteSupportFile: boolean;
  isTestFile: boolean;
  isIntegrationTest: boolean;
  isScript: boolean;
  isUiFile: boolean;
  isDenseUiFile: boolean;
  isAppShellFile: boolean;
  isRouteRegistrarIndex: boolean;
}

function countLoc(lines: string[]): number {
  return lines.filter((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith("//") && !trimmed.startsWith("#");
  }).length;
}

function isGeneratedFile(filePath: string): boolean {
  return /\.gen\.|\.generated\.|payload-types|\.d\.ts$|payload\.config/.test(filePath);
}

function getFileExtension(fileName: string): string {
  const match = fileName.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? "other";
}

function buildFileContext(entry: FileEntry, architectureName?: ArchitectureProfileName): FileContext {
  const architecture = getArchitectureProfile(architectureName);
  const filePath = entry.path;
  const lines = entry.lines;
  const fileName = filePath.split("/").pop() ?? "";
  const extension = getFileExtension(fileName);
  const isRouteFile = /\/routes\//.test(filePath);
  const isTestFile = /\.(test|spec|int\.test)\.(ts|tsx|js|jsx|py)$|__tests__|tests\//.test(filePath);
  const isIntegrationTest = /int\.test\.|integration|e2e/.test(filePath);
  const isScript = /\/scripts\/|\/seeds?\/|\/migrations?\/|\.seed\.|\.migration\./.test(filePath);
  const isUiFile = /\.(tsx|jsx)$/.test(filePath) || /\/(components|pages|app)\//.test(filePath);
  const isDenseUiFile = isUiFile && /(table|grid|graph|chart|dashboard|detail|sidebar|form|editor|panel|workspace|overview)/i.test(filePath);
  const isAppShellFile = /(^|\/)(app|layout|root|sidebar|app-sidebar)\.(tsx|jsx)$/.test(filePath);
  const isRouteSupportFile = isRouteFile && /(schema|schemas|type|types|constants?|helpers?|utils?|validation|config)/i.test(fileName);
  const isRouteRegistrarIndex = Boolean(
    architecture?.allowRouteRegistrarIndex &&
    isRouteFile &&
    fileName === "index.ts"
  );
  const role = classifyLocBucket({
    entry,
    filePath,
    fileName,
    extension,
    cohortKey: "",
    lines,
    loc: countLoc(lines),
    isGenerated: isGeneratedFile(filePath),
    isRouteFile,
    isRouteSupportFile,
    isTestFile,
    isIntegrationTest,
    isScript,
    isUiFile,
    isDenseUiFile,
    isAppShellFile,
    isRouteRegistrarIndex,
  });

  return {
    entry,
    filePath,
    fileName,
    extension,
    cohortKey: `${role}:${extension}`,
    lines,
    loc: countLoc(lines),
    isGenerated: isGeneratedFile(filePath),
    isRouteFile,
    isRouteSupportFile,
    isTestFile,
    isIntegrationTest,
    isScript,
    isUiFile,
    isDenseUiFile,
    isAppShellFile,
    isRouteRegistrarIndex,
  };
}

function classifyLocBucket(context: FileContext): LocBucket {
  if (context.isIntegrationTest) return "integration-test";
  if (context.isTestFile) return "test";
  if (context.isScript) return "script";
  if (context.isRouteSupportFile) return "route-support";
  if (context.isRouteFile && !context.isRouteRegistrarIndex) return "route";
  if (context.isAppShellFile) return "app-shell";
  if (context.isDenseUiFile) return "dense-ui";
  if (context.isUiFile) return "ui";
  return "default";
}

function percentile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower] ?? 0;
  const weight = index - lower;
  const lowerValue = sorted[lower] ?? 0;
  const upperValue = sorted[upper] ?? lowerValue;
  return lowerValue + (upperValue - lowerValue) * weight;
}

function roundUp(value: number): number {
  return Math.ceil(value / 25) * 25;
}

function applyDynamicLift(base: LocLimits, values: number[], bucket: LocBucket): LocLimits {
  if (values.length < MIN_BUCKET_SIZE_FOR_DYNAMIC_LIMITS) {
    return base;
  }

  const maxRatio = BUCKET_MAX_LIFT_RATIO[bucket];
  const liftedSoft = Math.min(roundUp(percentile(values, 0.8)), Math.round(base.soft * maxRatio));
  const liftedHard = Math.min(roundUp(percentile(values, 0.92)), Math.round(base.hard * maxRatio));
  const liftedGod = Math.min(roundUp(percentile(values, 0.98)), Math.round(base.god * maxRatio));

  const soft = Math.max(base.soft, liftedSoft);
  const hard = Math.max(base.hard, liftedHard, soft + 100);
  const god = Math.max(base.god, liftedGod, hard + 150);

  return { soft, hard, god };
}

function getBaseLimits(context: FileContext, architectureName?: ArchitectureProfileName): LocLimits {
  const architecture = getArchitectureProfile(architectureName);
  const bucket = classifyLocBucket(context);
  const bucketBase = BUCKET_BASE_LIMITS[bucket];

  if (!architecture) {
    return bucketBase;
  }

  if (bucket === "route" && !context.isRouteRegistrarIndex) {
    return architecture.loc.routeSlice;
  }

  return {
    soft: Math.max(bucketBase.soft, architecture.loc.default.soft),
    hard: Math.max(bucketBase.hard, architecture.loc.default.hard),
    god: Math.max(bucketBase.god, architecture.loc.default.god),
  };
}

function buildDynamicLimits(contexts: FileContext[], architectureName?: ArchitectureProfileName): Map<string, LocLimits> {
  const valuesByCohort = new Map<string, number[]>();

  for (const context of contexts) {
    if (context.isGenerated) continue;
    const values = valuesByCohort.get(context.cohortKey) ?? [];
    values.push(context.loc);
    valuesByCohort.set(context.cohortKey, values);
  }

  const limitsByCohort = new Map<string, LocLimits>();
  for (const context of contexts) {
    if (limitsByCohort.has(context.cohortKey)) continue;
    const bucket = classifyLocBucket(context);
    const base = getBaseLimits(context, architectureName);
    limitsByCohort.set(context.cohortKey, applyDynamicLift(base, valuesByCohort.get(context.cohortKey) ?? [], bucket));
  }

  return limitsByCohort;
}

export function runFileMetricsFromEntries(entries: FileEntry[], options: FileMetricsOptions = {}): Issue[] {
  const issues: Issue[] = [];
  const architecture = getArchitectureProfile(options.architecture);
  const contexts = entries.map((entry) => buildFileContext(entry, options.architecture));
  const dynamicLimits = buildDynamicLimits(contexts, options.architecture);

  for (const context of contexts) {
    const { filePath, lines, fileName, loc, isGenerated, isRouteRegistrarIndex, isTestFile, isScript } = context;
    const limits = dynamicLimits.get(context.cohortKey) ?? getBaseLimits(context, options.architecture);

    const barrelExports = lines.filter((line) =>
      /^\s*export\s+\*\s+from\s+/.test(line) || /^\s*export\s+\{[^}]+\}\s+from\s+/.test(line)
    ).length;
    const totalExports = lines.filter((line) => /^\s*export\s/.test(line)).length;
    const hasStarReexport = lines.some((line) => /^\s*export\s+\*\s+from\s+/.test(line));
    const isCuratedPublicIndex = Boolean(
      architecture?.allowCuratedIndexBarrels &&
      fileName === "index.ts" &&
      totalExports > 0 &&
      barrelExports === totalExports &&
      !hasStarReexport &&
      !isRouteRegistrarIndex
    );

    if (totalExports > 3 && barrelExports / totalExports > 0.7 && !isCuratedPublicIndex) {
      issues.push({
        id: "BARREL_FILE",
        category: "complexity",
        severity: "MEDIUM",
        tier: 0,
        file: filePath,
        line: 1,
        message: `Barrel export file — ${barrelExports}/${totalExports} exports are re-exports. Direct imports are faster (Atlassian: 75% build speed gain)`,
        tool: "file-metrics",
      });
    }

    for (let i = 0; i < lines.length; i++) {
      if (/^\s*export\s+\*\s+from\s+/.test(lines[i] ?? "")) {
        issues.push({
          id: "STAR_REEXPORT",
          category: "inconsistency",
          severity: "HIGH",
          tier: 0,
          file: filePath,
          line: i + 1,
          message: "export * from — pollutes namespace, hides what's exposed. Use named exports.",
          tool: "file-metrics",
        });
      }
    }

    const hasRoute = lines.some((line) =>
      /router\.(get|post|put|patch|delete)\s*\(/.test(line) ||
      /app\.(get|post|put|patch|delete)\s*\(/.test(line) ||
      /@(Get|Post|Put|Patch|Delete)\(/.test(line) ||
      /export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/.test(line) ||
      /procedure\s*\(\s*\)/.test(line)
    );
    const hasDbQuery = lines.some((line) =>
      /prisma\.\w+\.(find|create|update|delete|upsert|count|aggregate)/.test(line) ||
      /\.query\s*\(/.test(line) ||
      /session\.(execute|query|scalar)/.test(line) ||
      /\bdb\.\w+\.(find|insert|update|delete|select)/.test(line)
    );
    if (hasRoute && hasDbQuery && loc > 100 && !isTestFile && !isScript) {
      issues.push({
        id: "MIXED_CONCERNS",
        category: "complexity",
        severity: "HIGH",
        tier: 0,
        file: filePath,
        line: 1,
        message: "Route handler contains direct DB queries — extract to service/repository layer",
        tool: "file-metrics",
      });
    }

    const importPaths = new Set<string>();
    for (const line of lines) {
      const match = line.match(/(?:import|from)\s+["']([^"']+)["']/);
      if (match?.[1]) importPaths.add(match[1]);
    }
    if (importPaths.size >= 15 && !isGenerated && !isCuratedPublicIndex && !isRouteRegistrarIndex) {
      issues.push({
        id: "IMPORT_HEAVY",
        category: "complexity",
        severity: "MEDIUM",
        tier: 0,
        file: filePath,
        line: 1,
        message: `File imports from ${importPaths.size} modules — too many concerns in one file`,
        tool: "file-metrics",
      });
    }

    const httpMethods = new Set<string>();
    for (const line of lines) {
      const match = line.match(/\.(get|post|put|patch|delete)\s*\(/i);
      if (match?.[1]) httpMethods.add(match[1].toLowerCase());
    }
    if (httpMethods.size >= 4 && !isRouteRegistrarIndex) {
      issues.push({
        id: "MONOLITH_ROUTE",
        category: "complexity",
        severity: "MEDIUM",
        tier: 0,
        file: filePath,
        line: 1,
        message: `Route file handles ${httpMethods.size} HTTP methods — split into one file per endpoint (VSA)`,
        tool: "file-metrics",
      });
    }

    if (/^(utils|helpers|misc|common|shared|lib)\.(ts|tsx|js|jsx|py)$/.test(fileName) && loc > 100) {
      issues.push({
        id: "GENERIC_BUCKET_FILE",
        category: "naming-semantics",
        severity: "MEDIUM",
        tier: 0,
        file: filePath,
        line: 1,
        message: `Generic bucket file "${fileName}" with ${loc} lines — split into domain-specific modules`,
        tool: "file-metrics",
      });
    }

    if (/_v\d+|_old|_new|_backup|_copy|_fixed|_temp|_bak|_draft/.test(fileName)) {
      issues.push({
        id: "DEBUG_VARIANT_FILE",
        category: "ai-slop",
        severity: "MEDIUM",
        tier: 0,
        file: filePath,
        line: 1,
        message: `Debug variant file "${fileName}" — delete or rename (git has history)`,
        tool: "file-metrics",
      });
    }

    const isConfigFile = /config\.|settings\.|env\.|\.env/.test(filePath);
    let envCount = 0;
    if (!isConfigFile && !isTestFile) {
      for (const line of lines) {
        if (/process\.env\.\w+/.test(line)) envCount++;
      }
      if (envCount >= 3) {
        issues.push({
          id: "SCATTERED_ENV",
          category: "inconsistency",
          severity: "MEDIUM",
          tier: 0,
          file: filePath,
          line: 1,
          message: `${envCount} direct process.env accesses — centralize in a config module`,
          tool: "file-metrics",
        });
      }
    }

    let useStateCount = 0;
    if (/\.(tsx|jsx)$/.test(filePath)) {
      for (const line of lines) {
        if (/\buseState\s*[<(]/.test(line)) useStateCount++;
      }
      if (useStateCount >= 6) {
        issues.push({
          id: "MANY_USESTATE",
          category: "complexity",
          severity: "MEDIUM",
          tier: 0,
          file: filePath,
          line: 1,
          message: `${useStateCount} useState calls — consider useReducer or splitting the component`,
          tool: "file-metrics",
        });
      }
    }

    const secondaryComplexitySignals = [
      barrelExports / Math.max(totalExports, 1) > 0.7,
      hasRoute && hasDbQuery,
      importPaths.size >= 15,
      httpMethods.size >= 4,
      useStateCount >= 6,
      /^(utils|helpers|misc|common|shared|lib)\.(ts|tsx|js|jsx|py)$/.test(fileName) && loc > 100,
    ].filter(Boolean).length;

    if (loc >= limits.god && !isGenerated && secondaryComplexitySignals > 0) {
      issues.push({
        id: "GOD_FILE",
        category: "complexity",
        severity: "CRITICAL",
        tier: 0,
        file: filePath,
        line: 1,
        message: `File has ${loc} lines of code — split into domain modules (threshold: ${limits.god})`,
        tool: "file-metrics",
      });
    } else if (loc >= limits.hard && !isGenerated) {
      issues.push({
        id: "LARGE_FILE",
        category: "complexity",
        severity: "HIGH",
        tier: 0,
        file: filePath,
        line: 1,
        message: `File has ${loc} lines of code — approaching god file territory (threshold: ${loc >= limits.god ? limits.god : limits.hard})`,
        tool: "file-metrics",
      });
    } else if (loc >= limits.soft && !isGenerated) {
      issues.push({
        id: "LONG_FILE",
        category: "complexity",
        severity: "MEDIUM",
        tier: 0,
        file: filePath,
        line: 1,
        message: `File has ${loc} lines of code — consider splitting (threshold: ${limits.soft})`,
        tool: "file-metrics",
      });
    }

    for (let i = 0; i < lines.length; i++) {
      const routeMatch = (lines[i] ?? "").match(/\.(get|post|put|patch|delete)\s*\(\s*["'`]\/[^"'`]*\b(create|get|fetch|update|delete|remove|process|handle|retrieve|list)\w*["'`]/i);
      if (routeMatch) {
        issues.push({
          id: "VERB_IN_ROUTE",
          category: "inconsistency",
          severity: "LOW",
          tier: 0,
          file: filePath,
          line: i + 1,
          message: "Verb in REST route path — HTTP method is already the verb. Use nouns only.",
          tool: "file-metrics",
        });
      }
    }
  }

  return issues;
}

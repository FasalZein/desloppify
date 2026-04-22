import type { Issue } from "../types";

export interface ExternalAnalyzerResult {
  issues: Issue[];
  warning?: string;
}

export function externalSuccess(issues: Issue[]): ExternalAnalyzerResult {
  return { issues };
}

export function externalWarning(tool: string, message: string, stderr = ""): ExternalAnalyzerResult {
  const detail = stderr.trim();
  const summary = detail ? `${message} (${summarizeStderr(detail)})` : message;
  return {
    issues: [],
    warning: `${tool}: ${summary}`,
  };
}

export function externalDeltaIdentity(...parts: Array<string | number | undefined | null>): string | undefined {
  const normalized = parts
    .filter((part): part is string | number => part !== undefined && part !== null)
    .map((part) => String(part).trim().replace(/\s+/g, " "))
    .filter(Boolean);

  return normalized.length > 0 ? normalized.join(":") : undefined;
}

function summarizeStderr(stderr: string): string {
  return stderr.replace(/\s+/g, " ").slice(0, 220);
}

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Issue } from "../types";
import { resolveToolCommand } from "../tool-command";
import { asArray, asObject, getNumber, getString, type JsonObject } from "./json-value";
import { getJsTsLintMeta } from "./lint-metadata";
import { externalDeltaIdentity, externalSuccess, externalWarning, type ExternalAnalyzerResult } from "./external-result";

const BIOME_CONFIG_FILES = ["biome.json", "biome.jsonc"] as const;

function pickBiomePath(diagnostic: JsonObject): string {
  const location = asObject(diagnostic.location);
  const locationPath = asObject(location?.path);
  const path = asObject(diagnostic.path);
  const file = asObject(diagnostic.file);
  return getString(locationPath?.file) ?? getString(locationPath?.path) ?? getString(path?.file) ?? getString(file?.path) ?? "unknown";
}

function pickBiomeLine(diagnostic: JsonObject): number {
  const location = asObject(diagnostic.location);
  const firstSpan = asObject(asArray(location?.span)[0]);
  const sourceCode = asObject(location?.sourceCode);
  return getNumber(firstSpan?.lineNumber) ?? getNumber(firstSpan?.startLine) ?? getNumber(sourceCode?.lineNumber) ?? getNumber(location?.line) ?? 0;
}

function pickBiomeColumn(diagnostic: JsonObject): number | undefined {
  const location = asObject(diagnostic.location);
  const firstSpan = asObject(asArray(location?.span)[0]);
  const sourceCode = asObject(location?.sourceCode);
  return getNumber(firstSpan?.column) ?? getNumber(firstSpan?.startColumn) ?? getNumber(sourceCode?.columnNumber) ?? getNumber(location?.column);
}

function pickBiomeEndLine(diagnostic: JsonObject): number | undefined {
  const location = asObject(diagnostic.location);
  const firstSpan = asObject(asArray(location?.span)[0]);
  return getNumber(firstSpan?.endLineNumber) ?? getNumber(firstSpan?.endLine);
}

function pickBiomeEndColumn(diagnostic: JsonObject): number | undefined {
  const location = asObject(diagnostic.location);
  const firstSpan = asObject(asArray(location?.span)[0]);
  return getNumber(firstSpan?.endColumn) ?? getNumber(location?.endColumn);
}

export async function runBiome(targetPath: string): Promise<ExternalAnalyzerResult> {
  if (!BIOME_CONFIG_FILES.some((file) => existsSync(join(targetPath, file)))) return externalSuccess([]);

  const result = Bun.spawnSync([resolveToolCommand(targetPath, "biome"), "check", ".", "--reporter=json"], {
    cwd: targetPath,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120_000,
  });

  if (result.exitCode !== 0 && result.exitCode !== 1) {
    return externalWarning("biome", `command exited with code ${result.exitCode ?? 1}`, result.stderr.toString());
  }

  const stdout = result.stdout.toString().trim();
  if (!stdout) {
    return result.exitCode === 1
      ? externalWarning("biome", "reported issues but produced no JSON output", result.stderr.toString())
      : externalSuccess([]);
  }

  try {
    const parsed: unknown = JSON.parse(stdout);
    const data = asObject(parsed);
    if (!data) return externalWarning("biome", "JSON output was not an object", result.stderr.toString());

    const issues = asArray(data.diagnostics).flatMap((entry) => {
      const diagnostic = asObject(entry);
      if (!diagnostic) return [];

      const firstMessage = asObject(asArray(diagnostic.message)[0]);
      const rawRuleId = getString(diagnostic.category) ?? getString(diagnostic.rule) ?? "biome/unknown";
      const ruleId = rawRuleId.replace(/^lint\//, "");
      const meta = getJsTsLintMeta(ruleId);
      const text = getString(diagnostic.description) ?? getString(firstMessage?.text) ?? ruleId;
      return [{
        id: `BIOME_${ruleId.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}`,
        category: meta.category,
        severity: meta.severity,
        tier: meta.tier,
        file: pickBiomePath(diagnostic),
        line: pickBiomeLine(diagnostic),
        column: pickBiomeColumn(diagnostic),
        endLine: pickBiomeEndLine(diagnostic),
        endColumn: pickBiomeEndColumn(diagnostic),
        message: text,
        fix: meta.fix,
        tool: "biome",
        deltaIdentity: externalDeltaIdentity(rawRuleId, text),
      } satisfies Issue];
    });

    return externalSuccess(issues);
  } catch {
    return externalWarning("biome", "failed to parse JSON output", result.stderr.toString());
  }
}

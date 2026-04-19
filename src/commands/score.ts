import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { resolve } from "path";
import type { Issue } from "../types";
import { detectTools } from "../tools";
import { walkFiles } from "../analyzers/file-walker";
import { buildArchitectureSummary, isArchitectureProfile, resolveArchitectureProfileName } from "../architecture";
import { createSpinner, humanCategory, scanIntro, scanOutro, showScore, showTools, t } from "../ui";
import { getPackExternalTasks, resolvePackSelection, runPackInternalAnalyzers } from "../packs";
import { applyConfigToIssues, loadDesloppifyConfig } from "../config";
import { loadConfigPluginRules, runConfigPluginRules } from "../plugin-rules";
import { calculateScore, CATEGORY_WEIGHTS, getGrade, MAX_CATEGORY_PENALTY, SEVERITY_POINTS } from "../scoring";

const VERSION = "1.0.1";

/**
 * Scoring system for desloppify.
 *
 * Score = 100 - penalty points.
 * See ../scoring.ts for the shared implementation used by commands and reports.
 */

export default defineCommand({
  meta: { name: "score", description: "Calculate a weighted quality score for the codebase" },
  args: {
    path: { type: "positional", description: "Path to scan", default: "." },
    json: { type: "boolean", description: "JSON output" },
    architecture: { type: "string", description: "Architecture profile (e.g. modular-monolith)" },
    pack: { type: "string", description: "Rule pack (e.g. js-ts)" },
  },
  async run({ args }) {
    const targetPath = resolve(args.path);
    if (args.architecture && !isArchitectureProfile(args.architecture)) {
      throw new Error(`Unknown architecture profile: ${args.architecture}`);
    }

    const architecture = resolveArchitectureProfileName(args.architecture);
    const pack = resolvePackSelection(args.pack);
    const tools = detectTools();
    const loadedConfig = loadDesloppifyConfig(targetPath);
    const pluginRules = loadConfigPluginRules(loadedConfig.config, targetPath);
    const allIssues: Issue[] = [];
    const isJson = args.json;
    const t0 = performance.now();

    if (!isJson) {
      scanIntro(VERSION);
      showTools(tools);
      p.log.info(`Pack: ${pack.name}${pack.explicit ? "" : " (default)"}`);
      if (architecture) p.log.info(`Architecture: ${architecture}`);
      if (loadedConfig.path) p.log.info(`Config: ${loadedConfig.path}`);
    }

    const spin = isJson ? null : createSpinner();

    spin?.start("Walking file tree...");
    const entries = await walkFiles(targetPath);

    spin?.message(`Analyzing ${entries.length} files...`);
    allIssues.push(...runPackInternalAnalyzers(pack.name, entries, { architecture }));
    spin?.stop(`${entries.length} files scanned — ${allIssues.length} issues from pattern analysis`);

    if (pluginRules.length > 0) {
      allIssues.push(...runConfigPluginRules(entries, pluginRules, targetPath));
    }

    const tasks = getPackExternalTasks(pack.name, targetPath, tools);

    if (tasks.length > 0) {
      const extSpin = isJson ? null : createSpinner();
      extSpin?.start("Running external analyzers...");
      const results = await Promise.all(tasks.map((task) => task.promise));
      let extCount = 0;
      for (const issues of results) {
        extCount += issues.length;
        allIssues.push(...issues);
      }
      extSpin?.stop(`External tools done — ${extCount} additional issues`);
    }

    const configuredIssues = applyConfigToIssues(allIssues, loadedConfig.config, targetPath);
    const { score, grade, penalty, categoryScores } = calculateScore(configuredIssues);

    const architectureSummary = buildArchitectureSummary(architecture, configuredIssues);

    if (isJson) {
      console.log(JSON.stringify({
        score,
        grade,
        pack,
        architecture: architectureSummary,
        totalIssues: configuredIssues.length,
        totalPenalty: Math.round(penalty * 10) / 10,
        categories: categoryScores,
      }, null, 2));
      return;
    }

    showScore(score, grade, configuredIssues.length, penalty);

    const sorted = Object.entries(categoryScores)
      .sort((a, b) => b[1].penalty - a[1].penalty);

    if (sorted.length > 0) {
      const maxLabel = Math.max(...sorted.map(([cat]) => humanCategory(cat).length));
      const lines = sorted.map(([cat, data]) => {
        const cappedPenalty = Math.min(data.penalty, MAX_CATEGORY_PENALTY);
        const gauge = "█".repeat(Math.max(1, Math.min(15, Math.ceil(cappedPenalty))));
        const rawPenalty = Math.round(data.penalty * 10) / 10;
        const capped = data.penalty > MAX_CATEGORY_PENALTY
          ? ` ${t.dim}(capped ${MAX_CATEGORY_PENALTY})${t.reset}`
          : "";

        return [
          `${t.cream}${humanCategory(cat).padEnd(maxLabel)}${t.reset}`,
          `${String(data.count).padStart(4)} issues`,
          `${String(rawPenalty).padStart(5)} pts`,
          `${t.dim}${data.weight}x${t.reset}`,
          `${t.orange}${gauge}${t.reset}${capped}`,
        ].join("  ");
      });

      p.note(lines.join("\n"), `${t.orange}Weighted categories${t.reset}`);
    }

    if (architectureSummary) {
      const topViolations = Object.entries(architectureSummary.violations)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => `${id}: ${count}`)
        .join("\n");
      p.note([
        `Profile: ${architectureSummary.profile}`,
        `Fit: ${architectureSummary.fitScore}/100`,
        topViolations ? `Top violations:\n${topViolations}` : "Top violations: none",
      ].join("\n\n"), "Architecture");
    }

    p.log.info("Grade scale: A+(95-100) A(85-94) B(70-84) C(50-69) D(30-49) F(0-29)");
    scanOutro(performance.now() - t0, entries.length);
    process.exit(score < 50 ? 1 : 0);
  },
});

export { calculateScore, getGrade, SEVERITY_POINTS, CATEGORY_WEIGHTS };

import { defineCommand } from "citty";
import { getArchitectureProfile, isArchitectureProfile, resolveArchitectureProfileName } from "../architecture";
import { isRuleInPack, resolvePackSelection } from "../packs";
import { BUILTIN_RULE_CATALOG } from "../rule-catalog";
import { getRuleScoreWeight, getRuleSeverityOverride, isRuleEnabled, loadDesloppifyConfig } from "../config";

export default defineCommand({
  meta: { name: "rules", description: "List all detection rules" },
  args: {
    category: { type: "string", description: "Filter by category" },
    architecture: { type: "string", description: "Architecture profile (e.g. modular-monolith)" },
    pack: { type: "string", description: "Rule pack (e.g. js-ts, python)" },
    json: { type: "boolean", description: "JSON output" },
  },
  run({ args }) {
    if (args.architecture && !isArchitectureProfile(args.architecture)) {
      throw new Error(`Unknown architecture profile: ${args.architecture}`);
    }

    const architecture = resolveArchitectureProfileName(args.architecture);
    const profile = getArchitectureProfile(architecture);
    const pack = args.pack ? resolvePackSelection(args.pack) : null;
    const loadedConfig = loadDesloppifyConfig(process.cwd());

    const filtered = BUILTIN_RULE_CATALOG.filter((r) => {
      if (args.category && r.category !== args.category) return false;
      if (profile && !profile.ruleIds.includes(r.id)) return false;
      if (pack && !isRuleInPack(pack.name, r.id)) return false;
      if (!isRuleEnabled(loadedConfig.config, r.id)) return false;
      return true;
    }).map((rule) => ({
      ...rule,
      severityOverride: getRuleSeverityOverride(loadedConfig.config, rule.id) ?? null,
      scoreWeight: getRuleScoreWeight(loadedConfig.config, rule.id) ?? null,
    }));

    if (args.json) {
      console.log(JSON.stringify(filtered, null, 2));
      return;
    }

    const maxId = Math.max(...filtered.map((r) => r.id.length));
    const maxCat = Math.max(...filtered.map((r) => r.category.length));

    if (architecture) {
      console.log(`Architecture profile: ${architecture}`);
      console.log("");
    }
    if (pack) {
      console.log(`Pack: ${pack.name}`);
      console.log("");
    }
    if (loadedConfig.path) {
      console.log(`Config: ${loadedConfig.path}`);
      console.log("");
    }

    console.log(`${"RULE".padEnd(maxId)}  ${"CATEGORY".padEnd(maxCat)}  TIER  TOOL      DESCRIPTION`);
    console.log("─".repeat(maxId + maxCat + 50));

    for (const r of filtered) {
      const tierStr = r.tier === 0 ? "flag" : `T${r.tier}  `;
      const overrides = [
        r.severityOverride ? `severity=${r.severityOverride}` : null,
        r.scoreWeight ? `weight=${r.scoreWeight}` : null,
      ].filter(Boolean).join(", ");
      console.log(
        `${r.id.padEnd(maxId)}  ${r.category.padEnd(maxCat)}  ${tierStr}  ${r.tool.padEnd(8)}  ${overrides ? `${r.desc} (${overrides})` : r.desc}`
      );
    }

    console.log(`\n${filtered.length} rules total`);
  },
});

import { defineCommand } from "citty";
import { getArchitectureProfile, isArchitectureProfile, resolveArchitectureProfileName } from "../architecture";
import { isRuleInPack, resolvePackSelection } from "../packs";
import { GREP_EXTENDED_RULE_CATALOG } from "../analyzers/grep-extended-rules";
import { GREP_PATTERN_RULE_CATALOG } from "../analyzers/grep-pattern-rules";

const RULES = [
  // dead-code
  { id: "DEAD_EXPORT", category: "dead-code", tier: 3, tool: "knip", desc: "Exported symbol with no importers" },
  { id: "DEAD_FUNCTION", category: "dead-code", tier: 3, tool: "knip", desc: "Function defined but never called" },
  { id: "DEAD_FILE", category: "dead-code", tier: 3, tool: "knip", desc: "File not imported anywhere" },
  { id: "DEAD_DEPENDENCY", category: "dead-code", tier: 3, tool: "knip", desc: "Package in deps but never imported" },
  { id: "DEAD_VARIABLE", category: "dead-code", tier: 2, tool: "ast-grep", desc: "Variable declared but never read" },

  // weak-types
  { id: "ANY_TYPE", category: "weak-types", tier: 3, tool: "ast-grep", desc: "Explicit 'any' type annotation" },
  { id: "AS_ANY_CAST", category: "weak-types", tier: 3, tool: "ast-grep", desc: "'as any' type cast" },
  { id: "IMPLICIT_ANY", category: "weak-types", tier: 3, tool: "tsc", desc: "Implicit any from missing annotation" },
  { id: "OBJECT_TYPE", category: "weak-types", tier: 3, tool: "ast-grep", desc: "'object' type — too broad" },
  { id: "FUNCTION_TYPE", category: "weak-types", tier: 3, tool: "ast-grep", desc: "'Function' type — untyped" },
  { id: "TYPE_IGNORE", category: "weak-types", tier: 0, tool: "grep", desc: "type: ignore / @ts-ignore suppression" },

  // ai-slop
  { id: "CONSOLE_LOG", category: "ai-slop", tier: 1, tool: "ast-grep", desc: "console.log in production code" },
  { id: "PRINT_STATEMENT", category: "ai-slop", tier: 1, tool: "ast-grep", desc: "Python print() in production code" },
  { id: "PASS_STUB", category: "ai-slop", tier: 0, tool: "ast-grep", desc: "Python pass-only function body (stub)" },

  // circular-deps
  { id: "CIRCULAR_IMPORT", category: "circular-deps", tier: 3, tool: "madge", desc: "Import cycle between modules" },

  // duplication
  { id: "DUPLICATE_FUNCTION", category: "duplication", tier: 0, tool: "ast-grep", desc: "Near-identical function bodies" },
  { id: "DUPLICATE_LITERAL", category: "duplication", tier: 2, tool: "grep", desc: "Same string literal 3+ occurrences" },

  // defensive-programming
  { id: "EMPTY_CATCH", category: "defensive-programming", tier: 2, tool: "ast-grep", desc: "Empty catch block" },
  { id: "CATCH_RETURN_DEFAULT", category: "defensive-programming", tier: 2, tool: "ast-grep", desc: "Catch returns default — hides error" },
  { id: "CATCH_LOG_CONTINUE", category: "defensive-programming", tier: 2, tool: "ast-grep", desc: "Catch logs and continues" },
  { id: "NOOP_CALLBACK", category: "defensive-programming", tier: 2, tool: "ast-grep", desc: "No-op callback fallback" },
  { id: "DEEP_OPTIONAL_CHAIN", category: "defensive-programming", tier: 0, tool: "ast-grep", desc: "Optional chain 3+ deep" },
  { id: "BARE_EXCEPT", category: "defensive-programming", tier: 2, tool: "ast-grep", desc: "Python bare except catches everything" },
  { id: "UNWRAP_CALL", category: "defensive-programming", tier: 0, tool: "ast-grep", desc: "Rust .unwrap() can panic" },
  { id: "EXPECT_CALL", category: "defensive-programming", tier: 0, tool: "ast-grep", desc: "Rust .expect() can panic" },

  // legacy-code
  { id: "TODO_MACRO", category: "legacy-code", tier: 0, tool: "ast-grep", desc: "Rust todo!()/unimplemented!() macro" },

  // type-fragmentation
  { id: "DUPLICATE_TYPE", category: "type-fragmentation", tier: 0, tool: "ast-grep", desc: "Same type defined in multiple files" },
  { id: "INLINE_TYPE", category: "type-fragmentation", tier: 0, tool: "ast-grep", desc: "Complex inline type that should be named" },

  // inconsistency
  { id: "MIXED_NAMING", category: "inconsistency", tier: 0, tool: "grep", desc: "Mixed naming conventions in file" },
  { id: "MIXED_EXPORTS", category: "inconsistency", tier: 0, tool: "grep", desc: "Mixed export styles in file" },
  { id: "UNLISTED_DEPENDENCY", category: "inconsistency", tier: 0, tool: "knip", desc: "Imported but not in package.json" },

  // complexity
  { id: "LONG_FUNCTION", category: "complexity", tier: 0, tool: "grep", desc: "Function exceeds 50 lines" },
  { id: "MANY_PARAMS", category: "complexity", tier: 0, tool: "ast-grep", desc: "Function with 5+ parameters" },

  // security-slop

  // additional ai-slop

  // additional inconsistency

  // additional legacy

  // new ai-slop rules from real-world audit

  // new security-slop

  // new complexity

  // new ast-grep structural rules
  { id: "BROAD_EXCEPT", category: "defensive-programming", tier: 0, tool: "ast-grep", desc: "Python except Exception — too broad" },
  { id: "STAR_IMPORT", category: "inconsistency", tier: 0, tool: "ast-grep", desc: "Python star import — import specific names" },

  // file-level metrics (modularity, architecture)
  { id: "GOD_FILE", category: "complexity", tier: 0, tool: "file-metrics", desc: "File exceeds critical LOC threshold — split into modules" },
  { id: "LARGE_FILE", category: "complexity", tier: 0, tool: "file-metrics", desc: "File exceeds hard LOC threshold — approaching god file" },
  { id: "LONG_FILE", category: "complexity", tier: 0, tool: "file-metrics", desc: "File exceeds soft LOC threshold — consider splitting" },
  { id: "BARREL_FILE", category: "complexity", tier: 0, tool: "file-metrics", desc: "Barrel re-export file — use direct imports" },
  { id: "STAR_REEXPORT", category: "inconsistency", tier: 0, tool: "file-metrics", desc: "export * from — pollutes namespace" },
  { id: "MIXED_CONCERNS", category: "complexity", tier: 0, tool: "file-metrics", desc: "Route + DB queries in same file — split layers" },
  { id: "LAYER_BOUNDARY_VIOLATION", category: "complexity", tier: 0, tool: "architecture-profile", desc: "Route imports repository/model/db internals" },
  { id: "PRIVATE_MODULE_IMPORT", category: "inconsistency", tier: 0, tool: "architecture-profile", desc: "Cross-module import bypasses target public API" },
  { id: "IMPORT_HEAVY", category: "complexity", tier: 0, tool: "file-metrics", desc: "15+ imports — too many concerns in one file" },
  { id: "MONOLITH_ROUTE", category: "complexity", tier: 0, tool: "file-metrics", desc: "4+ HTTP methods in one file — split to VSA" },
  { id: "GENERIC_BUCKET_FILE", category: "naming-semantics", tier: 0, tool: "file-metrics", desc: "utils/helpers/misc file — split by domain" },
  { id: "DEBUG_VARIANT_FILE", category: "ai-slop", tier: 0, tool: "file-metrics", desc: "Debug variant file (_v2, _old, _backup)" },
  { id: "SCATTERED_ENV", category: "inconsistency", tier: 0, tool: "file-metrics", desc: "3+ process.env in non-config file" },
  { id: "MANY_USESTATE", category: "complexity", tier: 0, tool: "file-metrics", desc: "6+ useState in one component" },
  { id: "VERB_IN_ROUTE", category: "inconsistency", tier: 0, tool: "file-metrics", desc: "Verb in REST route path — use nouns" },

  // migrated grep-patterns family
  ...GREP_PATTERN_RULE_CATALOG,

  // migrated grep-extended family
  ...GREP_EXTENDED_RULE_CATALOG,
];

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

    const filtered = RULES.filter((r) => {
      if (args.category && r.category !== args.category) return false;
      if (profile && !profile.ruleIds.includes(r.id)) return false;
      if (pack && !isRuleInPack(pack.name, r.id)) return false;
      return true;
    });

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

    console.log(`${"RULE".padEnd(maxId)}  ${"CATEGORY".padEnd(maxCat)}  TIER  TOOL      DESCRIPTION`);
    console.log("─".repeat(maxId + maxCat + 50));

    for (const r of filtered) {
      const tierStr = r.tier === 0 ? "flag" : `T${r.tier}  `;
      console.log(
        `${r.id.padEnd(maxId)}  ${r.category.padEnd(maxCat)}  ${tierStr}  ${r.tool.padEnd(8)}  ${r.desc}`
      );
    }

    console.log(`\n${filtered.length} rules total`);
  },
});

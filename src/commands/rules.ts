import { defineCommand } from "citty";

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
  { id: "BANNER_COMMENT", category: "ai-slop", tier: 1, tool: "grep", desc: "ASCII banner separator" },
  { id: "NARRATION_COMMENT", category: "ai-slop", tier: 1, tool: "grep", desc: "Process narration comment" },
  { id: "APOLOGETIC_COMMENT", category: "ai-slop", tier: 1, tool: "grep", desc: "Apologetic/suggestive comment" },
  { id: "OBVIOUS_JSX_LABEL", category: "ai-slop", tier: 1, tool: "grep", desc: "JSX comment restating the tag name" },
  { id: "DEMO_PLACEHOLDER", category: "ai-slop", tier: 1, tool: "grep", desc: "Demo/placeholder/mock data marker" },
  { id: "CONSOLE_LOG", category: "ai-slop", tier: 1, tool: "ast-grep", desc: "console.log in production code" },
  { id: "HEDGING_COMMENT", category: "ai-slop", tier: 1, tool: "grep", desc: "Uncertainty hedging — 'should work', 'hopefully'" },
  { id: "SECTION_LABEL_COMMENT", category: "ai-slop", tier: 1, tool: "grep", desc: "Section label in flat file — // Setup, // Cleanup" },
  { id: "INSTRUCTIONAL_COMMENT", category: "ai-slop", tier: 1, tool: "grep", desc: "Tutorial voice — 'Make sure to', 'Don't forget'" },
  { id: "STATED_RETURN_COMMENT", category: "ai-slop", tier: 1, tool: "grep", desc: "Comment narrates the return value" },
  { id: "TRIPLE_NULL_GUARD", category: "ai-slop", tier: 2, tool: "grep", desc: "Triple null/undefined/empty guard" },
  { id: "EXPLICIT_TRUE_COMPARE", category: "ai-slop", tier: 1, tool: "grep", desc: "Redundant === true/false comparison" },
  { id: "RETURN_UNDEFINED", category: "ai-slop", tier: 1, tool: "grep", desc: "Explicit return undefined — just return;" },
  { id: "PLACEHOLDER_VAR_NAME", category: "ai-slop", tier: 0, tool: "grep", desc: "Meaningless variable name — data2, temp1, foo" },
  { id: "LINT_ESCAPE", category: "ai-slop", tier: 0, tool: "grep", desc: "Lint suppression instead of fixing the issue" },
  { id: "ENTRY_EXIT_LOG", category: "ai-slop", tier: 1, tool: "grep", desc: "Function entry/exit debugging log" },
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
  { id: "LOG_AND_RETHROW", category: "defensive-programming", tier: 2, tool: "grep", desc: "Catch-log-rethrow adds no value" },
  { id: "BARE_EXCEPT", category: "defensive-programming", tier: 2, tool: "ast-grep", desc: "Python bare except catches everything" },
  { id: "UNWRAP_CALL", category: "defensive-programming", tier: 0, tool: "ast-grep", desc: "Rust .unwrap() can panic" },
  { id: "EXPECT_CALL", category: "defensive-programming", tier: 0, tool: "ast-grep", desc: "Rust .expect() can panic" },

  // legacy-code
  { id: "DEPRECATED_ANNOTATION", category: "legacy-code", tier: 2, tool: "grep", desc: "@deprecated code still present" },
  { id: "TODO_REMOVE", category: "legacy-code", tier: 1, tool: "grep", desc: "TODO flagged for removal" },
  { id: "DEAD_FEATURE_FLAG", category: "legacy-code", tier: 0, tool: "grep", desc: "Feature flag always on/off" },
  { id: "FIXME_HACK_XXX", category: "legacy-code", tier: 0, tool: "grep", desc: "FIXME/HACK/XXX — known bad code" },
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
  { id: "DEEP_NESTING", category: "complexity", tier: 0, tool: "grep", desc: "Conditional nesting 3+ levels" },
  { id: "MANY_PARAMS", category: "complexity", tier: 0, tool: "ast-grep", desc: "Function with 5+ parameters" },
  { id: "NESTED_TERNARY", category: "complexity", tier: 0, tool: "grep", desc: "Nested ternary chain" },

  // security-slop
  { id: "HARDCODED_SECRET", category: "security-slop", tier: 0, tool: "grep", desc: "Hardcoded password/secret/key/token" },
  { id: "HARDCODED_URL", category: "security-slop", tier: 0, tool: "grep", desc: "Hardcoded localhost or API URL" },
  { id: "SQL_INJECTION", category: "security-slop", tier: 0, tool: "grep", desc: "SQL string concatenation — use params" },

  // additional ai-slop
  { id: "COMMENTED_CODE_BLOCK", category: "ai-slop", tier: 1, tool: "grep", desc: "Commented-out code line" },
  { id: "PLACEHOLDER_VALUE", category: "ai-slop", tier: 0, tool: "grep", desc: "Placeholder value shipped in code" },

  // additional inconsistency
  { id: "MIXED_IMPORT_STYLE", category: "inconsistency", tier: 0, tool: "grep", desc: "require() in ESM — use import" },

  // additional legacy
  { id: "CALLBACK_STYLE", category: "legacy-code", tier: 0, tool: "grep", desc: "Callback-style API — use promises" },

  // additional defensive
  { id: "UNCHECKED_PROMISE", category: "defensive-programming", tier: 0, tool: "grep", desc: "Empty .then()/.catch()" },
];

export default defineCommand({
  meta: { name: "rules", description: "List all detection rules" },
  args: {
    category: { type: "string", description: "Filter by category" },
    json: { type: "boolean", description: "JSON output" },
  },
  run({ args }) {
    const filtered = args.category
      ? RULES.filter((r) => r.category === args.category)
      : RULES;

    if (args.json) {
      console.log(JSON.stringify(filtered, null, 2));
      return;
    }

    const maxId = Math.max(...filtered.map((r) => r.id.length));
    const maxCat = Math.max(...filtered.map((r) => r.category.length));

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

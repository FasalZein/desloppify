const JS_TS_SOURCE_FILE = /\.(ts|tsx|js|jsx)$/;
const JS_TS_TEXT_FILE = /\.(ts|tsx|js|jsx|html)$/;
const PYTHON_FILE = /\.py$/;
const RUST_FILE = /\.rs$/;
const GO_FILE = /\.go$/;
const RUBY_FILE = /\.rb$/;

export const PACK_CATALOG = {
  "js-ts": {
    description: "JavaScript / TypeScript / React heuristics and tool adapters",
    projectSignals: ["javascript", "typescript", "react"] as const,
    sourceFilePattern: JS_TS_SOURCE_FILE,
    textFilePattern: JS_TS_TEXT_FILE,
    disabledRuleIds: ["DEAD_VARIABLE"] as const,
  },
  python: {
    description: "Python heuristics with python-scoped grep and ast-grep rules",
    projectSignals: ["python"] as const,
    filePattern: PYTHON_FILE,
    patternRuleIds: [
      "BANNER_COMMENT",
      "TODO_REMOVE",
      "HEDGING_COMMENT",
      "SECTION_LABEL_COMMENT",
      "INSTRUCTIONAL_COMMENT",
      "EXPLICIT_TRUE_COMPARE",
      "PLACEHOLDER_VAR_NAME",
      "LINT_ESCAPE",
      "FIXME_HACK_XXX",
      "HARDCODED_SECRET",
      "HARDCODED_URL",
      "COMMENTED_CODE_BLOCK",
      "DEBUG_BREAKPOINT",
    ] as const,
    extendedRuleIds: [
      "ASSERT_TRUE",
      "SKIPPED_TEST",
      "REQUESTS_IN_ASYNC",
      "EVAL_EXEC",
      "PICKLE_LOADS",
      "UNSAFE_YAML_LOAD",
      "SUBPROCESS_SHELL_TRUE",
      "MUTABLE_DEFAULT",
      "BUILTIN_SHADOW",
      "ITERROWS",
    ] as const,
    astRuleIds: ["BARE_EXCEPT", "PASS_STUB", "PRINT_STATEMENT", "BROAD_EXCEPT", "STAR_IMPORT"] as const,
  },
  rust: {
    description: "Rust heuristics with rust-scoped ast-grep rules",
    projectSignals: ["rust"] as const,
    filePattern: RUST_FILE,
    astRuleIds: ["UNWRAP_CALL", "EXPECT_CALL", "TODO_MACRO"] as const,
  },
  go: {
    description: "Go heuristics with go-scoped grep rules and external lint adapters",
    projectSignals: ["go"] as const,
    filePattern: GO_FILE,
    patternRuleIds: [
      "BANNER_COMMENT",
      "TODO_REMOVE",
      "HEDGING_COMMENT",
      "SECTION_LABEL_COMMENT",
      "INSTRUCTIONAL_COMMENT",
      "LINT_ESCAPE",
      "FIXME_HACK_XXX",
      "HARDCODED_SECRET",
      "HARDCODED_URL",
      "COMMENTED_CODE_BLOCK",
      "DEBUG_BREAKPOINT",
    ] as const,
    extendedRuleIds: [
      "PANIC_CALL_GO",
      "ERROR_STRING_COMPARE_GO",
      "GO_TEST_SKIP",
    ] as const,
  },
  ruby: {
    description: "Ruby heuristics with ruby-scoped grep rules and rubocop adapter",
    projectSignals: ["ruby"] as const,
    filePattern: RUBY_FILE,
    patternRuleIds: [
      "BANNER_COMMENT",
      "TODO_REMOVE",
      "HEDGING_COMMENT",
      "SECTION_LABEL_COMMENT",
      "INSTRUCTIONAL_COMMENT",
      "LINT_ESCAPE",
      "FIXME_HACK_XXX",
      "HARDCODED_SECRET",
      "HARDCODED_URL",
      "COMMENTED_CODE_BLOCK",
      "DEBUG_BREAKPOINT",
    ] as const,
    extendedRuleIds: [
      "RUBY_PUTS_DEBUG",
      "RUBY_BARE_RESCUE",
      "RUBY_TEST_SKIP",
    ] as const,
  },
} as const;

export type PackName = keyof typeof PACK_CATALOG;

export const PACK_NAMES = Object.keys(PACK_CATALOG) as PackName[];

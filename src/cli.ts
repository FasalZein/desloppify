#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "desloppify",
    version: "1.0.2",
    description: "Your AI wrote spaghetti. This eats it.\n\nUsage: desloppify <command> [options]\n\nExit codes: scan/score exit 1 when issues are found (useful for CI), 0 when clean.",
  },
  subCommands: {
    scan: () => import("./commands/scan").then((m) => m.default),
    report: () => import("./commands/report").then((m) => m.default),
    benchmark: () => import("./commands/benchmark").then((m) => m.default),
    delta: () => import("./commands/delta").then((m) => m.default),
    fix: () => import("./commands/fix").then((m) => m.default),
    rules: () => import("./commands/rules").then((m) => m.default),
    "check-tools": () => import("./commands/check-tools").then((m) => m.default),
    "install-skill": () => import("./commands/install-skill").then((m) => m.default),
    "install-hooks": () => import("./commands/install-hooks").then((m) => m.default),
    "hook-gate": () => import("./commands/hook-gate").then((m) => m.default),
    "suggest-pack": () => import("./commands/suggest-pack").then((m) => m.default),
    setup: () => import("./commands/setup").then((m) => m.default),
    worktrees: () => import("./commands/worktrees").then((m) => m.default),
    score: () => import("./commands/score").then((m) => m.default),
    // Aliases for common patterns
    version: () => Promise.resolve(defineCommand({
      meta: { name: "version", description: "Print version" },
      run() { console.log("1.0.2"); },
    })),
    help: () => Promise.resolve(defineCommand({
      meta: { name: "help", description: "Show help" },
      run() { runMain(main, { rawArgs: ["--help"] }); },
    })),
  },
});

runMain(main);

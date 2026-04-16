#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "desloppify",
    version: "0.0.1",
    description: "Agent-agnostic code cleanup CLI. Detects 116+ rules across 16 categories of AI code rot.",
  },
  subCommands: {
    scan: () => import("./commands/scan").then((m) => m.default),
    fix: () => import("./commands/fix").then((m) => m.default),
    rules: () => import("./commands/rules").then((m) => m.default),
    "check-tools": () => import("./commands/check-tools").then((m) => m.default),
    worktrees: () => import("./commands/worktrees").then((m) => m.default),
    score: () => import("./commands/score").then((m) => m.default),
  },
});

runMain(main);

#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "desloppify",
    version: "1.0.0",
    description: "Agent-agnostic code cleanup CLI. Detects 10 categories of code rot.",
  },
  subCommands: {
    scan: () => import("./commands/scan").then((m) => m.default),
    fix: () => import("./commands/fix").then((m) => m.default),
    rules: () => import("./commands/rules").then((m) => m.default),
    "check-tools": () => import("./commands/check-tools").then((m) => m.default),
  },
});

runMain(main);

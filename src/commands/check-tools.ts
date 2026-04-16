import { defineCommand } from "citty";
import { resolve } from "path";
import * as p from "@clack/prompts";
import { getRecommendations, detectProject } from "../tools";

export default defineCommand({
  meta: { name: "check-tools", description: "Show available analysis tools and install recommendations" },
  args: {
    path: { type: "positional", description: "Project path", default: "." },
    json: { type: "boolean", description: "JSON output" },
  },
  run({ args }) {
    const targetPath = resolve(args.path);
    const project = detectProject(targetPath);
    const recs = getRecommendations(targetPath);

    if (args.json) {
      console.log(JSON.stringify({ project, tools: recs }, null, 2));
      return;
    }

    const t = {
      orange: "\x1b[38;5;208m",
      green: "\x1b[32m",
      red: "\x1b[31m",
      dim: "\x1b[38;5;244m",
      bold: "\x1b[1m",
      reset: "\x1b[0m",
    };

    p.intro(`${t.orange}${t.bold}desloppify${t.reset} ${t.dim}check-tools${t.reset}`);

    // Project detection
    const detected = Object.entries(project)
      .filter(([, v]) => v)
      .map(([k]) => k);
    p.log.info(`Project: ${detected.length > 0 ? detected.join(", ") : "unknown"}`);

    // Installed tools
    const installed = recs.filter((r) => r.available);
    const missing = recs.filter((r) => !r.available);

    if (installed.length > 0) {
      const lines = installed.map((r) =>
        `${t.green}✓${t.reset} ${t.bold}${r.name}${t.reset}  ${t.dim}${r.description}${t.reset}`
      );
      p.note(lines.join("\n"), `${t.green}Installed${t.reset} ${t.dim}(${installed.length})${t.reset}`);
    }

    if (missing.length > 0) {
      const lines = missing.map((r) =>
        `${t.red}✗${t.reset} ${t.bold}${r.name}${t.reset}  ${t.dim}${r.description}${t.reset}\n` +
        `  ${t.dim}${r.relevance}${t.reset}\n` +
        `  ${t.orange}${r.install}${t.reset}`
      );
      p.note(lines.join("\n\n"), `${t.orange}Recommended${t.reset} ${t.dim}(${missing.length})${t.reset}`);
    }

    const coverage = Math.round((installed.length / recs.length) * 100);
    p.outro(`${t.dim}${installed.length}/${recs.length} tools available (${coverage}% coverage)${t.reset}`);
  },
});

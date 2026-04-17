import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { formatSetupGuide } from "../setup";

export default defineCommand({
  meta: { name: "setup", description: "Show first-run setup steps for skill install, hooks, score visibility, and your first scan" },
  run() {
    p.intro("desloppify setup");
    p.note(formatSetupGuide(), "Next steps");
    p.outro("Setup guide ready");
  },
});

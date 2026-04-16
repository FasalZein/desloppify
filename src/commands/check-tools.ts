import { defineCommand } from "citty";
import { detectTools, printToolStatus } from "../tools";

export default defineCommand({
  meta: { name: "check-tools", description: "Show available analysis tools" },
  args: {
    json: { type: "boolean", description: "JSON output" },
  },
  run({ args }) {
    const tools = detectTools();

    if (args.json) {
      console.log(JSON.stringify(tools, null, 2));
      return;
    }

    console.log("Available analysis tools:");
    console.log(printToolStatus(tools));

    const available = Object.values(tools).filter(Boolean).length;
    const total = Object.keys(tools).length;
    console.log(`\n${available}/${total} tools available`);

    if (!tools["ast-grep"]) {
      console.log("\nRecommended: install ast-grep for best coverage");
      console.log("  brew install ast-grep  (or)  npm i -g @ast-grep/cli");
    }
  },
});

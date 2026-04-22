import { defineCommand } from "citty";
import { main as runHookGateMain } from "../hook-gate";

export default defineCommand({
  meta: { name: "hook-gate", description: "Internal command used by installed git hooks" },
  args: {
    mode: { type: "positional", description: "Hook mode", default: "run" },
  },
  async run({ args }) {
    await runHookGateMain(args.mode);
  },
});

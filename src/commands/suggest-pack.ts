import { defineCommand } from "citty";
import { resolve } from "node:path";
import { detectSuggestedPack } from "../tools";

export default defineCommand({
  meta: { name: "suggest-pack", description: "Internal command used by installed git hooks" },
  args: {
    path: { type: "positional", description: "Project path", default: "." },
  },
  run({ args }) {
    console.log(detectSuggestedPack(resolve(args.path)) ?? "js-ts");
  },
});

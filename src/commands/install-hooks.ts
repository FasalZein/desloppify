import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { getHooksInstallCommand, installHooks } from "../setup";

export default defineCommand({
  meta: { name: "install-hooks", description: "Install the repo-local git hooks for staged and branch-diff scans" },
  args: {
    print: { type: "boolean", description: "Print the install command without running it" },
  },
  run({ args }) {
    const install = getHooksInstallCommand();

    if (args.print) {
      console.log(install.display);
      return;
    }

    p.intro("desloppify install-hooks");

    const { repoRoot, hooksDir } = installHooks();

    p.log.info(`Scaffolded hooks in: ${hooksDir}`);
    p.log.info(`Configured core.hooksPath in: ${repoRoot}`);
    p.outro("Hooks installed");
  },
});

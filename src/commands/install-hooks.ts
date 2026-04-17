import { spawnSync } from "node:child_process";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { getHooksInstallCommand } from "../setup";

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
    p.log.info(`Running: ${install.display}`);

    const result = spawnSync(install.command, install.args, {
      stdio: "inherit",
      shell: true,
    });

    if (result.error) {
      throw result.error;
    }

    if ((result.status ?? 0) !== 0) {
      process.exit(result.status ?? 1);
    }

    p.outro("Hooks installed");
  },
});

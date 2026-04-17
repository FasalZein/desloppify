import { spawnSync } from "node:child_process";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { getSkillInstallCommand } from "../setup";

export default defineCommand({
  meta: { name: "install-skill", description: "Install the desloppify skill via the canonical skills command" },
  args: {
    print: { type: "boolean", description: "Print the install command without running it" },
  },
  run({ args }) {
    const install = getSkillInstallCommand();

    if (args.print) {
      console.log(install.display);
      return;
    }

    p.intro("desloppify install-skill");
    p.log.info(`Running: ${install.display}`);

    const result = spawnSync(install.command, install.args, {
      stdio: "inherit",
    });

    if (result.error) {
      throw result.error;
    }

    if ((result.status ?? 0) !== 0) {
      process.exit(result.status ?? 1);
    }

    p.outro("Skill installed");
  },
});

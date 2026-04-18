import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import command from "./check-tools";

const run = (args: string[]) => Bun.spawnSync(["bun", "src/cli.ts", "check-tools", ...args], {
  cwd: process.cwd(),
  stdout: "pipe",
  stderr: "pipe",
});

describe("check-tools command", () => {
  test("declares json arg", () => {
    expect(command.meta.name).toBe("check-tools");
    expect(command.args).toHaveProperty("json");
  });

  test("json output includes detected packs and suggestion", () => {
    const root = mkdtempSync(join(tmpdir(), "desloppify-check-tools-"));
    writeFileSync(join(root, "requirements.txt"), "ruff\n");

    const result = run([root, "--json"]);
    const output = JSON.parse(result.stdout.toString());

    expect(result.exitCode).toBe(0);
    expect(output.packs).toEqual({ available: ["python"], suggested: "python" });
  });
});

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempRoots: string[] = [];
const cliPath = join(process.cwd(), "src/cli.ts");

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("scan command ruby pack", () => {
  test("scan --pack ruby emits ruby findings only", () => {
    const root = mkdtempSync(join(tmpdir(), "desloppify-scan-ruby-"));
    tempRoots.push(root);
    mkdirSync(join(root, "app"), { recursive: true });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "Gemfile"), "source 'https://rubygems.org'\n");
    writeFileSync(join(root, "app", "main.rb"), "puts 'debug'\nbegin\n  work\nrescue\n  nil\nend\n");
    writeFileSync(join(root, "src", "view.tsx"), "useEffect(async () => { await load(); }, []);\n");

    const result = Bun.spawnSync(["bun", cliPath, "scan", root, "--pack", "ruby", "--json"], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = JSON.parse(result.stdout.toString()) as { findings: Array<{ rule_id: string }> };

    expect(result.exitCode).toBe(1);
    expect(output.findings.map((finding) => finding.rule_id)).toEqual(expect.arrayContaining([
      "RUBY_PUTS_DEBUG",
      "RUBY_BARE_RESCUE",
    ]));
    expect(output.findings.map((finding) => finding.rule_id)).not.toContain("USEEFFECT_ASYNC");
  });
});

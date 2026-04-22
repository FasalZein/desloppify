import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectTools } from "../tools";

const tempRoots: string[] = [];
const cliPath = join(process.cwd(), "src/cli.ts");

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("scan command rust pack", () => {
  test("scan --pack rust emits rust findings only", () => {
    if (!detectTools()["ast-grep"]) return;

    const root = mkdtempSync(join(tmpdir(), "desloppify-scan-rust-"));
    tempRoots.push(root);
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "Cargo.toml"), "[package]\nname = \"demo\"\nversion = \"0.1.0\"\n");
    writeFileSync(join(root, "src", "main.rs"), "fn main() { let value = Some(1); value.unwrap(); }\n");
    writeFileSync(join(root, "src", "view.tsx"), "useEffect(async () => { await load(); }, []);\n");

    const result = Bun.spawnSync(["bun", cliPath, "scan", root, "--pack", "rust", "--json"], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = JSON.parse(result.stdout.toString()) as { findings: Array<{ rule_id: string }> };

    expect(result.exitCode).toBe(1);
    expect(output.findings.map((finding) => finding.rule_id)).toContain("UNWRAP_CALL");
    expect(output.findings.map((finding) => finding.rule_id)).not.toContain("USEEFFECT_ASYNC");
  });
});

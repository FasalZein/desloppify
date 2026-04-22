import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const version = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version;

const replacements = [
  ["src/cli.ts", [
    [/version: "[0-9]+\.[0-9]+\.[0-9]+"/, `version: "${version}"`],
    [/console\.log\("[0-9]+\.[0-9]+\.[0-9]+"\)/, `console.log("${version}")`],
  ]],
  ["src/commands/scan.ts", [
    [/scanIntro\("[0-9]+\.[0-9]+\.[0-9]+"\)/, `scanIntro("${version}")`],
  ]],
  ["src/commands/score.ts", [
    [/const VERSION = "[0-9]+\.[0-9]+\.[0-9]+";/, `const VERSION = "${version}";`],
  ]],
  ["src/report.ts", [
    [/version: "[0-9]+\.[0-9]+\.[0-9]+"/, `version: "${version}"`],
  ]],
  ["src/cli.test.ts", [
    [/toBe\("[0-9]+\.[0-9]+\.[0-9]+"\)/g, `toBe("${version}")`],
  ]],
  ["bin/desloppify.test.ts", [
    [/toBe\("[0-9]+\.[0-9]+\.[0-9]+"\)/, `toBe("${version}")`],
  ]],
  ["src/commands/scan.test.ts", [
    [/version: "[0-9]+\.[0-9]+\.[0-9]+"/, `version: "${version}"`],
  ]],
  ["src/benchmarks/report.test.ts", [
    [/analyzerVersion: "[0-9]+\.[0-9]+\.[0-9]+"/, `analyzerVersion: "${version}"`],
  ]],
  ["src/benchmarks/snapshot.test.ts", [
    [/createBenchmarkSnapshot\(set, repos, "[0-9]+\.[0-9]+\.[0-9]+"/, `createBenchmarkSnapshot(set, repos, "${version}"`],
  ]],
  ["src/benchmarks/types.test.ts", [
    [/analyzerVersion: "[0-9]+\.[0-9]+\.[0-9]+"/, `analyzerVersion: "${version}"`],
  ]],
  ["src/types.test.ts", [
    [/version: "[0-9]+\.[0-9]+\.[0-9]+"/g, `version: "${version}"`],
  ]],
];

for (const [file, fileReplacements] of replacements) {
  const path = resolve(root, file);
  let content = readFileSync(path, "utf8");
  for (const [pattern, replacement] of fileReplacements) {
    content = content.replace(pattern, replacement);
  }
  writeFileSync(path, content);
}

console.log(`Synced version ${version}`);

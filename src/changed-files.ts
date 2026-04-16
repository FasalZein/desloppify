import { resolve } from "path";

const CHANGED_FILE_ARGS = ["diff", "--name-only", "--diff-filter=ACMR"];

function runGit(repoRoot: string, args: string[]): string {
  const result = Bun.spawnSync(["git", ...args], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString().trim() || `git ${args.join(" ")} failed`);
  }

  return result.stdout.toString().trim();
}

export function parseGitFileList(output: string, repoRoot: string): string[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((file) => resolve(repoRoot, file));
}

export function pickDefaultBaseRef(refs: string[]): string | undefined {
  for (const candidate of ["origin/HEAD", "origin/main", "origin/master", "main", "master"]) {
    if (refs.includes(candidate)) return candidate;
  }
  return;
}

export function detectBaseRef(repoRoot: string): string {
  const refs = runGit(repoRoot, ["for-each-ref", "--format=%(refname:short)", "refs/heads", "refs/remotes"])
    .split("\n")
    .map((ref) => ref.trim())
    .filter(Boolean);

  const ref = pickDefaultBaseRef(refs);
  if (!ref) throw new Error("Could not detect a default base branch. Pass --base explicitly.");
  return ref;
}

export function listStagedFiles(repoRoot: string): string[] {
  const output = runGit(repoRoot, ["diff", "--cached", "--name-only", "--diff-filter=ACMR"]);
  return parseGitFileList(output, repoRoot);
}

export function listChangedFiles(repoRoot: string, base?: string): string[] {
  const baseRef = base ?? detectBaseRef(repoRoot);
  const mergeBase = runGit(repoRoot, ["merge-base", "HEAD", baseRef]).trim();
  const output = runGit(repoRoot, [...CHANGED_FILE_ARGS, `${mergeBase}...HEAD`]);
  return parseGitFileList(output, repoRoot);
}

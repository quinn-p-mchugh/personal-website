/**
 * Finds files added to the repository, using git.
 *
 * Only added files count: edits to existing posts are never re-posted.
 * Needs the repository's history; in GitHub Actions, check out with
 * "fetch-depth: 0".
 * Docs: https://git-scm.com/docs/git-diff#Documentation/git-diff.txt---diff-filterACDMRTUXB82308203
 * Tests: test/cli/addedFiles.test.js
 */
import { execFileSync } from "node:child_process";

/** What a push's "before" commit is when the branch is new. */
const NO_COMMIT = /^0+$/;

/**
 * Runs git and returns its output lines.
 *
 * Args:
 *     args: git's arguments.
 *     cwd: The repository folder.
 *
 * Returns:
 *     Non-empty output lines.
 *
 * Raises:
 *     Error: If git fails.
 */
function git(args, cwd) {
  const output = execFileSync("git", ["-c", "core.quotepath=off", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return output.split("\n").map((line) => line.trim()).filter(Boolean);
}

/**
 * Tells whether a commit exists in the repository.
 *
 * Args:
 *     commit: A commit hash.
 *     cwd: The repository folder.
 *
 * Returns:
 *     True if git knows the commit.
 */
function commitExists(commit, cwd) {
  try {
    git(["cat-file", "-e", `${commit}^{commit}`], cwd);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lists files added between a commit and the current one.
 *
 * Args:
 *     since: The commit before the push (GitHub's "before"). When it's
 *         empty, all zeros (a new branch) or unknown (after a force-push),
 *         the files added by the current commit alone are used.
 *     cwd: The repository folder.
 *
 * Returns:
 *     Paths relative to the repository root, sorted, without repeats.
 */
export function filesAddedSince(since, cwd = process.cwd()) {
  if (!since || NO_COMMIT.test(since) || !commitExists(since, cwd)) {
    return [...new Set(git(["diff-tree", "--root", "--no-commit-id", "-r", "--name-only", "--diff-filter=A", "HEAD"], cwd))].sort();
  }
  return [...new Set(git(["diff", "--name-only", "--diff-filter=A", since, "HEAD"], cwd))].sort();
}

/**
 * Lists files added by commits in the last few days.
 *
 * Args:
 *     days: How many days back to look.
 *     cwd: The repository folder.
 *
 * Returns:
 *     Paths relative to the repository root, sorted, without repeats.
 */
export function filesAddedInLastDays(days, cwd = process.cwd()) {
  return [...new Set(git(["log", `--since=${days} days ago`, "--diff-filter=A", "--name-only", "--pretty=format:"], cwd))].sort();
}

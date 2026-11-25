/**
 * Tests for src/cli/addedFiles.js, in a throwaway git repository.
 * Run with: npm test   (needs git)
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { filesAddedInLastDays, filesAddedSince } from "../../src/cli/addedFiles.js";

const repo = fs.mkdtempSync(path.join(os.tmpdir(), "crosspost-git-"));
let first;

/**
 * Runs git in the throwaway repository.
 *
 * Args:
 *     args: git's arguments.
 *
 * Returns:
 *     git's output, trimmed.
 */
const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();

/**
 * Commits files to the throwaway repository.
 *
 * Args:
 *     files: Paths to create or change.
 *
 * Returns:
 *     The new commit's hash.
 */
function commit(...files) {
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    fs.appendFileSync(path.join(repo, file), "x\n");
  }
  git("add", ".");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", files.join(" "));
  return git("rev-parse", "HEAD");
}

before(() => {
  git("init", "-q");
  first = commit("blog/old.md");
  commit("blog/new one.md", "blog/old.md");
  commit("blog/newer.md");
});
after(() => fs.rmSync(repo, { recursive: true, force: true }));

test("files added since a commit, ignoring edits, with spaces kept", () => {
  assert.deepEqual(filesAddedSince(first, repo), ["blog/new one.md", "blog/newer.md"]);
});

test("an unknown or all-zero commit means: the current commit's files", () => {
  assert.deepEqual(filesAddedSince("0000000000000000000000000000000000000000", repo), ["blog/newer.md"]);
  assert.deepEqual(filesAddedSince("deadbeef", repo), ["blog/newer.md"]);
  assert.deepEqual(filesAddedSince("", repo), ["blog/newer.md"]);
});

test("in a subfolder, paths are relative to it and other files are left out", () => {
  commit("site/blog/inner.md", "elsewhere.md");
  assert.deepEqual(filesAddedSince("", path.join(repo, "site")), ["blog/inner.md"]);
});

test("files added in the last few days", () => {
  assert.deepEqual(filesAddedInLastDays(3, repo), ["blog/new one.md", "blog/newer.md", "blog/old.md", "elsewhere.md", "site/blog/inner.md"]);
});

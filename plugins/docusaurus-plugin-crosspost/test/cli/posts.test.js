/**
 * Tests for src/cli/posts.js.
 * Run with: npm test   (Node 22 or newer; Node's built-in test runner. Needs
 * the npm packages installed, as for a build.)
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { blogOfFile, matchesAny, skipReason } from "../../src/cli/posts.js";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "crosspost-posts-"));
after(() => fs.rmSync(root, { recursive: true, force: true }));
const DEFAULT_EXCLUDE = ["**/_*.{js,jsx,ts,tsx,md,mdx}", "**/_*/**", "**/*.test.{js,jsx,ts,tsx}", "**/__tests__/**"];
const blogs = [
  { path: "blog", exclude: DEFAULT_EXCLUDE },
  { path: "blog-ideas", exclude: ["**/draft/**"] },
];

/**
 * Writes a file under the throwaway repository.
 *
 * Args:
 *     file: Its path inside the repository.
 *     text: Its contents.
 */
function write(file, text) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
}

test("blogOfFile finds the innermost blog, not look-alike folders", () => {
  assert.equal(blogOfFile("blog-ideas/a.md", blogs).blog.path, "blog-ideas");
  assert.equal(blogOfFile("blog/2026/a.md", blogs).relative, "2026/a.md");
  assert.equal(blogOfFile("docs/a.md", blogs), null);
});

test("matchesAny matches the way Docusaurus's exclude does", () => {
  assert.equal(matchesAny("2026/_template.md", DEFAULT_EXCLUDE), true);
  assert.equal(matchesAny("_drafts/a.md", DEFAULT_EXCLUDE), true);
  assert.equal(matchesAny("2026/a.md", DEFAULT_EXCLUDE), false);
});

test("posts to send: dated or not, listed, not drafts", async () => {
  write("blog/2026-11-24-dated.md", "---\ntitle: x\n---\n");
  write("blog/2026/11/24/nested.md", "---\n---\n");
  write("blog/front-matter-date.md", "---\ndate: 2026-11-24\n---\n");
  write("blog/Undated.md", "---\ntitle: Undated\n---\n");
  for (const file of ["blog/2026-11-24-dated.md", "blog/2026/11/24/nested.md", "blog/front-matter-date.md", "blog/Undated.md"]) {
    assert.equal(await skipReason(file, blogs, {}, root), null, file);
  }
});

test("--skip-undated leaves out posts without a date", async () => {
  assert.match(await skipReason("blog/Undated.md", blogs, { skipUndated: true }, root), /no date.*--skip-undated/);
  assert.equal(await skipReason("blog/front-matter-date.md", blogs, { skipUndated: true }, root), null);
  assert.equal(await skipReason("blog/2026-11-24-dated.md", blogs, { skipUndated: true }, root), null);
});

test("a blog's include patterns decide what counts as a post", async () => {
  const onlyPosts = [{ path: "blog", include: ["posts/**/*.md"], exclude: [] }];
  write("blog/posts/a.md", "---\n---\n");
  write("blog/notes/b.md", "---\n---\n");
  assert.equal(await skipReason("blog/posts/a.md", onlyPosts, {}, root), null);
  assert.equal(await skipReason("blog/notes/b.md", onlyPosts, {}, root), "", "not a post: nothing to report");
});

test("everything else is skipped, with a reason for blog files", async () => {
  write("blog/2026-11-24-draft.md", "---\ndraft: true\n---\n");
  write("blog/2026-11-24-unlisted.md", "---\nunlisted: true\n---\n");
  write("blog/_template.md", "---\n---\n");
  write("blog-ideas/draft/2026-11-24-a.md", "---\n---\n");
  write("blog/2026-11-24-ignored.md", "---\n---\n");
  const cases = {
    "README.md": "",
    "docs/a.md": "",
    "blog/image.png": "",
    "blog/2026-11-24-draft.md": "draft: true",
    "blog/2026-11-24-unlisted.md": "unlisted: true",
    "blog/_template.md": "exclude",
    "blog-ideas/draft/2026-11-24-a.md": "exclude",
    "blog/2026-11-24-gone.md": "no longer exists",
    "blog/2026-11-24-ignored.md": "--ignore",
  };
  for (const [file, reason] of Object.entries(cases)) {
    const actual = await skipReason(file, blogs, { ignore: ["**/*-ignored.md"] }, root);
    if (reason === "") assert.equal(actual, "", file);
    else assert.match(actual, new RegExp(reason.replace(/[-]/g, "\\$&")), file);
  }
});

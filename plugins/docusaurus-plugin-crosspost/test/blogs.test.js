/**
 * Tests for src/blogs.js.
 * Run with: npm test   (Node 22 or newer; Node's built-in test runner)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { blogOf, blogOptionObjects, blogSummary, isInside } from "../src/blogs.js";

test("blogOptionObjects finds the preset's blog and every blog plugin", () => {
  const preset = { path: "blog" };
  const extra = { path: "blog-micro" };
  const config = {
    presets: [["@docusaurus/preset-classic", { blog: preset }], "other-preset"],
    plugins: [["@docusaurus/plugin-content-blog", extra], ["@docusaurus/plugin-content-docs", { path: "docs" }], "some-plugin"],
  };
  const found = blogOptionObjects(config);
  assert.equal(found[0], preset);
  assert.equal(found[1], extra);
  assert.equal(found.length, 2);
  assert.deepEqual(blogOptionObjects({ presets: [["classic", { blog: false }]] }), [], "a turned-off blog isn't a blog");
});

test("blogSummary copies only path and tags, and only when set", () => {
  assert.deepEqual(blogSummary({ path: "b", tags: false, remarkPlugins: [1] }), { path: "b", tags: false });
  assert.deepEqual(blogSummary({}), {});
});

test("isInside and blogOf don't confuse look-alike folders", () => {
  assert.equal(isInside("/site/blog", "/site/blog-micro/a.md"), false);
  assert.equal(isInside("/site/blog", "/site/blog/..odd/a.md"), true);
  assert.equal(blogOf("/site/blog/inner/a.md", [{ path: "blog" }, { path: "blog/inner" }], "/site").options.path, "blog/inner");
  assert.equal(blogOf("/site/docs/a.md", [{}], "/site"), null);
});

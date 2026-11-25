/**
 * Tests for src/blogs.js.
 * Run with: npm test   (Node's built-in test runner)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { blogOf, blogOptionObjects, blogSummary, isInside, loadsPackage, localizedFolderName } from "../src/blogs.js";

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

test("the classic preset's blog is on unless blog is false, as in @docusaurus/preset-classic", () => {
  assert.deepEqual(blogOptionObjects({ presets: ["classic"] }), [{}]);
  assert.deepEqual(blogOptionObjects({ presets: [["@docusaurus/preset-classic", { docs: {} }]] }), [{}]);
  assert.deepEqual(blogOptionObjects({ presets: [false, null, ["classic", { blog: false }]] }), []);
});

test("blog plugins are found by full name, shorthand or file path", () => {
  const config = {
    plugins: [
      "content-blog",
      ["@docusaurus/plugin-content-blog", { id: "b" }],
      ["/site/node_modules/@docusaurus/plugin-content-blog/lib/index.js", { id: "c" }],
      ["C:\\site\\node_modules\\@docusaurus\\plugin-content-blog\\lib\\index.js", { id: "d" }],
      ["@docusaurus/plugin-content-docs", { id: "docs" }],
      ["docusaurus-plugin-content-blog-extras", {}],
      () => ({ name: "inline" }),
    ],
  };
  assert.deepEqual(blogOptionObjects(config).map((blog) => blog.id), [undefined, "b", "c", "d"]);
  assert.equal(loadsPackage("/x/@docusaurus/preset-classic", "@docusaurus/preset-classic", "classic"), true);
  assert.equal(loadsPackage(undefined, "@docusaurus/preset-classic", "classic"), false);
});

test("blogSummary copies only the settings hashtagsToTags needs, and only when set", () => {
  assert.deepEqual(blogSummary({ path: "b", tags: false, id: "x", onInlineTags: "throw", remarkPlugins: [1] }), {
    path: "b",
    tags: false,
    id: "x",
    onInlineTags: "throw",
  });
  assert.deepEqual(blogSummary({}), {});
});

test("isInside and blogOf don't confuse look-alike folders", () => {
  assert.equal(isInside("/site/blog", "/site/blog-micro/a.md"), false);
  assert.equal(isInside("/site/blog", "/site/blog/..odd/a.md"), true);
  assert.equal(blogOf("/site/blog/inner/a.md", [{ path: "blog" }, { path: "blog/inner" }], "/site").options.path, "blog/inner");
  assert.equal(blogOf("/site/docs/a.md", [{}], "/site"), null);
});

test("translated posts belong to their blog", () => {
  const blogs = [{ path: "blog" }, { path: "news", id: "news" }];
  const fr = blogOf("/site/i18n/fr/docusaurus-plugin-content-blog/a.md", blogs, "/site");
  assert.equal(fr.options.path, "blog");
  assert.equal(fr.localizedFolder, "/site/i18n/fr/docusaurus-plugin-content-blog");
  assert.equal(blogOf("/site/lang/de/docusaurus-plugin-content-blog-news/a.md", blogs, "/site", "lang").options.id, "news");
  assert.equal(blogOf("/site/i18n/fr/docusaurus-plugin-content-docs/a.md", blogs, "/site"), null);
  assert.equal(localizedFolderName("default"), "docusaurus-plugin-content-blog");
});

/**
 * Tests for src/hashtagsToTags.js.
 * Run with: npm test   (Node 22 or newer; Node's built-in test runner. Needs
 * the npm packages installed, as for a build.)
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { addHashtagTags, createParseFrontMatter, proseHashtags, siteDirOf, tagsForHashtags } from "../src/hashtagsToTags.js";

const site = fs.mkdtempSync(path.join(os.tmpdir(), "hashtags-to-tags-"));
fs.mkdirSync(path.join(site, "blog"));
fs.writeFileSync(path.join(site, "tags.yml"), "pkm:\n  label: Personal Knowledge Management\n");
after(() => fs.rmSync(site, { recursive: true, force: true }));

const labels = new Map([["pkm", "Personal Knowledge Management"]]);

test("proseHashtags ignores code, links, HTML and MDX", () => {
  const markdown = [
    "Notes on #PKM and #NewTopic.",
    "`#inline` [text](https://x.org/#frag) <a href='#top'>#inHtmlTag</a> {'#expr'}",
    "<!-- #comment -->",
    "```",
    "#fenced",
    "```",
    "[ref]: https://x.org/#ref",
  ].join("\n");
  assert.deepEqual(proseHashtags(markdown), ["PKM", "NewTopic", "inHtmlTag"]);
});

test("tagsForHashtags uses a tags file key when the hashtag matches its key or label", () => {
  assert.deepEqual(tagsForHashtags(["PKM", "PersonalKnowledgeManagement", "Other"], labels), ["pkm", "pkm", "Other"]);
});

test("addHashtagTags adds new tags once, skipping excepted and existing ones", () => {
  assert.deepEqual(addHashtagTags(["Climate"], ["climate", "PKM", "TIL", "Fresh", "fresh"], labels, ["til"]), [
    "Climate",
    "pkm",
    "Fresh",
  ]);
  assert.deepEqual(addHashtagTags(undefined, ["Fresh"], labels, []), ["Fresh"]);
  const unchanged = ["Climate"];
  assert.equal(addHashtagTags(unchanged, ["Climate"], labels, []), unchanged);
  assert.equal(addHashtagTags("not a list", ["Fresh"], labels, []), "not a list");
});

test("parseFrontMatter adds tags to blog posts only, when enabled", async () => {
  const parse = createParseFrontMatter({
    blogs: [{ path: "blog", tags: "../tags.yml" }],
    hashtagsToTags: { enabled: true, excludedHashtags: [] },
    siteDir: site,
  });
  const params = (filePath) => ({
    filePath: path.join(site, filePath),
    fileContent: "",
    defaultParseFrontMatter: async () => ({ frontMatter: { title: "" }, content: "About #PKM" }),
  });
  assert.deepEqual((await parse(params("blog/post.md"))).frontMatter.tags, ["pkm"]);
  assert.equal((await parse(params("docs/page.md"))).frontMatter.tags, undefined);

  const off = createParseFrontMatter({ blogs: [{ path: "blog" }], hashtagsToTags: { enabled: false, excludedHashtags: [] }, siteDir: site });
  assert.equal((await off(params("blog/post.md"))).frontMatter.tags, undefined);
});

test("with onInlineTags: \"throw\", only hashtags in the tags file become tags", async () => {
  const parse = createParseFrontMatter({
    blogs: [{ path: "blog", tags: "../tags.yml", onInlineTags: "throw" }],
    hashtagsToTags: { enabled: true, excludedHashtags: [] },
    siteDir: site,
  });
  const result = await parse({
    filePath: path.join(site, "blog/post.md"),
    fileContent: "",
    defaultParseFrontMatter: async () => ({ frontMatter: {}, content: "About #PKM and #Brand_New" }),
  });
  assert.deepEqual(result.frontMatter.tags, ["pkm"]);
});

test("the site folder is found from the file, wherever the build started", async () => {
  fs.writeFileSync(path.join(site, "docusaurus.config.mjs"), "export default {};\n");
  const cache = new Map();
  assert.equal(siteDirOf(path.join(site, "blog", "deep", "post.md"), cache), site);
  assert.equal(cache.get(path.join(site, "blog", "deep")), site, "remembered for next time");
  assert.equal(siteDirOf(path.join(os.tmpdir(), "no-site-here-x", "a.md")), null);

  const parse = createParseFrontMatter({ blogs: [{ path: "blog", tags: "../tags.yml" }], hashtagsToTags: { enabled: true, excludedHashtags: [] } });
  const result = await parse({
    filePath: path.join(site, "blog/post.md"),
    fileContent: "",
    defaultParseFrontMatter: async () => ({ frontMatter: {}, content: "#PKM" }),
  });
  assert.deepEqual(result.frontMatter.tags, ["pkm"]);
});

test("translated posts get tags too", async () => {
  const parse = createParseFrontMatter({ blogs: [{ path: "blog" }], hashtagsToTags: { enabled: true, excludedHashtags: [] }, siteDir: site });
  const result = await parse({
    filePath: path.join(site, "i18n/fr/docusaurus-plugin-content-blog/post.md"),
    fileContent: "",
    defaultParseFrontMatter: async () => ({ frontMatter: {}, content: "#Climat" }),
  });
  assert.deepEqual(result.frontMatter.tags, ["Climat"]);
});

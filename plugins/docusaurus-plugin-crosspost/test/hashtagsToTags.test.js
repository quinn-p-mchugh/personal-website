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
import { addHashtagTags, createParseFrontMatter, proseHashtags, tagsForHashtags } from "../src/hashtagsToTags.js";

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
    hashtagsToTags: { enabled: true, except: [] },
    siteDir: site,
  });
  const params = (filePath) => ({
    filePath: path.join(site, filePath),
    fileContent: "",
    defaultParseFrontMatter: async () => ({ frontMatter: { title: "" }, content: "About #PKM" }),
  });
  assert.deepEqual((await parse(params("blog/post.md"))).frontMatter.tags, ["pkm"]);
  assert.equal((await parse(params("docs/page.md"))).frontMatter.tags, undefined);

  const off = createParseFrontMatter({ blogs: [{ path: "blog" }], hashtagsToTags: { enabled: false, except: [] }, siteDir: site });
  assert.equal((await off(params("blog/post.md"))).frontMatter.tags, undefined);
});

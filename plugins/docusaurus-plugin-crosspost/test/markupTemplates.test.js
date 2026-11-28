/**
 * Tests for src/markupTemplates.js, and for template files in each format.
 * Run with: npm test   (Node's built-in test runner)
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderMarkdownTemplate, withoutFrontMatter } from "../src/markupTemplates.js";
import { loadTemplateFiles } from "../src/templateFiles.js";
import { chooseTemplate, renderTemplate } from "../src/socialText.js";

/** A post's details, as describePost in src/postPages.js builds them. */
function post(overrides = {}) {
  return {
    title: "",
    description: "",
    url: "https://example.com/blog/a",
    blogFolder: "blog",
    tags: [],
    contentHtml: "<p>Hello <a href=\"https://x.org\">world</a></p>",
    contentText: "Hello world",
    textHashtags: [],
    tagHashtags: [],
    ...overrides,
  };
}
const md = (template, overrides) => renderMarkdownTemplate(template, post(overrides));

test("Markdown: formatting, soft line breaks, lists, headings", async () => {
  assert.equal(await md("**{title}** and _more_\nsame paragraph", { title: "T" }), "<p><strong>T</strong> and <em>more</em>\nsame paragraph</p>");
  assert.equal(await md("- one\n- two\n\n1. first"), "<ul><li>one</li><li>two</li></ul><ol><li>first</li></ol>");
  assert.equal(await md("## {title}", { title: "T" }), "<h2>T</h2>");
  assert.equal(await md("line one  \nline two"), "<p>line one<br>line two</p>", "two spaces keep a line break");
  assert.equal(await md("**a**\n_b_"), "<p><strong>a</strong>\n<em>b</em></p>", "words on either side of a soft break stay apart");
});

test("Markdown: values are text, never Markdown or HTML", async () => {
  const html = await md("{title}", { title: "*Fish* & <Chips> {url}" });
  assert.equal(html, "<p>*Fish* &#x26; &#x3C;Chips> {url}</p>");
});

test("Markdown: {content} keeps the post's HTML; {hashtags} joins a hashtag-only last line", async () => {
  const p = { contentHtml: "<p>Hi</p><p>#Quote</p>", contentText: "Hi #Quote", tagHashtags: ["Climate"] };
  assert.equal(await md("{content}\n\n{hashtags}", p), "<p>Hi</p><p>#Quote #Climate</p>");
  assert.equal(await md("{content}\n\n{hashtags}", { tagHashtags: ["A"] }), `${post().contentHtml}<p>#A</p>`, "else its own paragraph");
  assert.equal(await md("#Resource\n\n{content}\n\n#Resource {hashtags}", { tagHashtags: ["A"] }), `<p>#Resource</p>${post().contentHtml}<p>#Resource #A</p>`, "#word is not a heading");
  assert.equal(await md("Read: {content}"), "<p>Read: Hello world</p>", "inside a line it is plain text");
});

test("Markdown: {url} is a link, or its text inside a link or an address", async () => {
  assert.equal(await md("{url}"), '<p><a href="https://example.com/blog/a">https://example.com/blog/a</a></p>');
  assert.equal(await md("[Read it]({url})"), '<p><a href="https://example.com/blog/a">Read it</a></p>');
  assert.equal(await md("[{url}]({url})"), '<p><a href="https://example.com/blog/a">https://example.com/blog/a</a></p>', "no link inside a link");
});

test("Markdown: lines with empty placeholders go, as in plain text", async () => {
  assert.equal(await md("{title}\n\nTags: {tags}\n\n{content}\n{description}"), post().contentHtml);
  assert.equal(await md("{content}", { contentHtml: "", contentText: "" }), "");
  assert.equal(await md("{content}\nmore", { contentHtml: "<p><img src=\"a.png\"></p>", contentText: "" }), "<p>more</p>", "inside a paragraph, {content} is text");
  const photo = { contentHtml: '<p><img src="a.png" alt=""></p>', contentText: "" };
  assert.equal(await md("{content}", photo), renderTemplate("{content}", post(photo)), "a post with only a photo keeps it");
  assert.equal(await md("\\{title\\} {title}", { title: "T" }), "<p>{title} T</p>", "a backslash keeps braces as typed");
});

test("Markdown: comments and front matter are notes; HTML in the template works", async () => {
  assert.equal(await md("<!-- note -->\n\n{content}"), post().contentHtml);
  assert.equal(await md("A <!-- note --> B"), "<p>A  B</p>");
  assert.equal(await md("<b>{title}</b>", { title: "a<b" }), "<p><b>a&#x3C;b</b></p>");
  assert.equal(withoutFrontMatter("---\nnote: for me\n---\n{content}\n"), "{content}\n");
  assert.equal(withoutFrontMatter("---\n---\n{content}"), "{content}", "an empty block");
  assert.equal(withoutFrontMatter("{content}\n---\nx\n---\n"), "{content}\n---\nx\n---\n", "only at the top");
});

test("Markdown: text in a post that looks like a marker stays as written", async () => {
  const html = await md("{content}", { contentHtml: "<p>QCROSSPOSTaaaatitleQ</p>" });
  assert.equal(html, "<p>QCROSSPOSTaaaatitleQ</p>");
});

test("both formats: {hashtags} still joins {content} across a paragraph that was left out", async () => {
  const p = { contentHtml: "<p>Hi</p><p>#Quote</p>", contentText: "Hi #Quote", tagHashtags: ["A"] };
  const template = "{content}\n\n{title}\n\n{hashtags}";
  assert.equal(renderTemplate(template, post(p)), "<p>Hi</p><p>#Quote #A</p>");
  assert.equal(await md(template, p), "<p>Hi</p><p>#Quote #A</p>");
});

test("plain text: Markdown stays as typed", () => {
  assert.equal(renderTemplate("**{title}**\n[a]({url})", post({ title: "T" })), '<p>**T**<br>[a](<a href="https://example.com/blog/a">https://example.com/blog/a</a>)</p>');
});

const site = fs.mkdtempSync(path.join(os.tmpdir(), "crosspost-formats-"));
const folder = path.join(site, "t");
fs.mkdirSync(folder);
fs.writeFileSync(path.join(folder, "a.txt"), "﻿---\r\n**{title}**\r\n");
fs.writeFileSync(path.join(folder, "a.md"), "﻿---\r\nnote: x\r\n---\r\n**{title}**\r\n");
fs.writeFileSync(path.join(folder, "b.MD"), "{title}");
fs.writeFileSync(path.join(folder, "a.mdx"), "{title}");
fs.writeFileSync(path.join(folder, "a.html"), "{title}");
fs.writeFileSync(path.join(folder, "typo.md"), "---\n{titel}: in front matter is fine\n---\n{titel}");
after(() => fs.rmSync(site, { recursive: true, force: true }));

test("a template file's extension decides how it is read", () => {
  const rules = ["a.txt", "a.md", "b.MD"].map((templateFile) => ({ appliesTo: {}, templateFile }));
  const [txt, mdFile, upper] = loadTemplateFiles(rules, "t", site);
  assert.deepEqual([txt.format, txt.template], ["text", "---\n**{title}**"], ".txt keeps everything but the byte order mark");
  assert.deepEqual([mdFile.format, mdFile.template], ["markdown", "**{title}**"], "front matter and the byte order mark go");
  assert.equal(upper.format, "markdown", "any letter case");
  assert.equal(chooseTemplate([mdFile], post()).format, "markdown");
  assert.equal(chooseTemplate([{ appliesTo: {}, template: "x" }], post()).format, "text", "inline templates are plain text");
});

test("other extensions, including .mdx, stop with a clear message", () => {
  assert.throws(() => loadTemplateFiles([{ templateFile: "a.html" }], "t", site), /a\.html.*\.txt \(plain text\) or \.md \(Markdown\)\.$/);
  assert.throws(() => loadTemplateFiles([{ templateFile: "a.mdx" }], "t", site), /MDX isn't supported, so use \.md/);
  assert.throws(() => loadTemplateFiles([{ templateFile: "typo.md" }], "t", site), /typo\.md.*\{titel\}/, "placeholders are checked after front matter goes");
});

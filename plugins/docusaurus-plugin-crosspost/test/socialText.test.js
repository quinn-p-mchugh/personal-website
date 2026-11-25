/**
 * Tests for src/socialText.js.
 * Run with: npm test   (Node 22 or newer; Node's built-in test runner)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendToHashtagParagraph,
  chooseTemplate,
  renderTemplate,
  ruleAppliesTo,
  unknownPlaceholders,
} from "../src/socialText.js";

/**
 * Builds a post's details, as describePost in src/postPages.js does.
 *
 * Args:
 *     overrides: Fields to change from the defaults.
 *
 * Returns:
 *     The post's details.
 */
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

test("ruleAppliesTo: any item within a list, all of the lists", () => {
  const ideas = post({ blogFolder: "blog-ideas", textHashtags: ["TIL"], tags: [{ key: "pkm", label: "PKM" }] });
  assert.equal(ruleAppliesTo({}, ideas), true, "no conditions applies to every post");
  assert.equal(ruleAppliesTo({ blogs: ["blog", "blog-ideas"] }, ideas), true);
  assert.equal(ruleAppliesTo({ blogs: ["./blog-ideas/"] }, ideas), true, "folder spelling is tidied");
  assert.equal(ruleAppliesTo({ blogs: ["blog"] }, ideas), false);
  assert.equal(ruleAppliesTo({ hashtags: ["#til", "Quote"] }, ideas), true, "with or without #, any case");
  assert.equal(ruleAppliesTo({ tags: ["pkm"] }, ideas), true, "by tag key");
  assert.equal(ruleAppliesTo({ tags: ["P K M"] }, ideas), true, "by tag label, loosely");
  assert.equal(ruleAppliesTo({ blogs: ["blog-ideas"], hashtags: ["Quote"] }, ideas), false, "every list must match");
  assert.equal(ruleAppliesTo({ blogs: ["blog-ideas"], hashtags: ["TIL"], tags: ["pkm"] }, ideas), true);
  assert.equal(ruleAppliesTo({ hasTitle: true }, ideas), false);
  assert.equal(ruleAppliesTo({ hasTitle: false }, ideas), true);
});

test("chooseTemplate: first matching rule, else the built-in text", () => {
  const rules = [
    { appliesTo: { blogs: ["blog-ideas"] }, template: "idea" },
    { appliesTo: {}, template: "everything else" },
  ];
  assert.deepEqual(chooseTemplate(rules, post({ blogFolder: "blog-ideas" })), { template: "idea", fromSettings: true });
  assert.deepEqual(chooseTemplate(rules, post()), { template: "everything else", fromSettings: true });
  assert.deepEqual(chooseTemplate([], post()), { template: "{content}\n\n{hashtags}", fromSettings: false });
  assert.equal(chooseTemplate([], post({ title: "T", tagHashtags: ["A"] })).template, "{title}: {url}\n\n{description}\n\n{hashtags}");
  assert.deepEqual(chooseTemplate([], post({ title: "T" })), { template: null, fromSettings: false }, "plain titled posts are left to Bridgy");
});

test("renderTemplate: paragraphs, line breaks, links and escaping", () => {
  const html = renderTemplate("{title}\n———\n{content}\n\n{hashtags}", post({ title: "Fish & <Chips>", tagHashtags: ["Food"] }));
  assert.equal(html, "<p>Fish &amp; &lt;Chips&gt;<br>———<br>Hello world</p><p>#Food</p>", "{content} mixed with text is plain");
  assert.equal(
    renderTemplate("{title}: {url}", post({ title: "T" })),
    '<p>T: <a href="https://example.com/blog/a">https://example.com/blog/a</a></p>'
  );
  assert.equal(renderTemplate("{content}", post()), post().contentHtml, "{content} alone keeps the post's HTML");
});

test("renderTemplate drops lines whose placeholders are empty", () => {
  assert.equal(renderTemplate("{title}\n\n{content}\n\n{description}\n\n{hashtags}", post()), post().contentHtml);
  assert.equal(renderTemplate("Tags: {tags}", post({ tags: [{ key: "a", label: "A" }, { key: null, label: "B" }] })), "<p>Tags: A, B</p>");
  assert.equal(renderTemplate("{hashtags}", post()), "");
});

test("hashtags join the post's own last line of hashtags", () => {
  const withLine = post({ contentHtml: "<p>Quote</p><p>#Quote #Reading</p>", tagHashtags: ["Climate"] });
  assert.equal(renderTemplate("{content}\n\n{hashtags}", withLine), "<p>Quote</p><p>#Quote #Reading #Climate</p>");
  const withoutLine = post({ contentHtml: "<p>Text #inline</p>", tagHashtags: ["Climate"] });
  assert.equal(renderTemplate("{content}\n\n{hashtags}", withoutLine), "<p>Text #inline</p><p>#Climate</p>");
  assert.equal(appendToHashtagParagraph("<p>#A <a>#B</a></p>", "#C"), "<p>#A <a>#B</a> #C</p>");
});

test("unknownPlaceholders finds typos", () => {
  assert.deepEqual(unknownPlaceholders("{title} {titel} {content} {x}"), ["titel", "x"]);
});

test("renderTemplate treats Windows line endings like plain newlines", () => {
  assert.equal(
    renderTemplate("{title}\r\n\r\n{content}", post({ title: "T" })),
    renderTemplate("{title}\n\n{content}", post({ title: "T" }))
  );
});

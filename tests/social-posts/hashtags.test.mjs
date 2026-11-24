/**
 * Tests for src/utils/hashtags.mjs and src/utils/socialPosts.mjs.
 * Run with: npm test   (Node 22 or newer; built-in test runner, no packages)
 * Docs: https://nodejs.org/api/test.html
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  excludedTagSet,
  hashtagNamesFromTags,
  isExcludedTag,
  newHashtagNames,
  toHashtagName,
} from "../../src/utils/hashtags.mjs";
import { hasTitle, socialPostSettings } from "../../src/utils/socialPosts.mjs";

test("toHashtagName joins words and capitalizes each", () => {
  assert.equal(toHashtagName("animal welfare"), "AnimalWelfare");
  assert.equal(toHashtagName("AI ethics"), "AIEthics");
  assert.equal(toHashtagName("Personal Knowledge Management (PKM)"), "PersonalKnowledgeManagementPKM");
  assert.equal(toHashtagName("हिन्दी भाषा"), "हिन्दीभाषा", "combining marks are kept");
});

test("toHashtagName gives '' for labels that can't be hashtags", () => {
  assert.equal(toHashtagName("2026"), "", "all digits");
  assert.equal(toHashtagName("!!"), "");
  assert.equal(toHashtagName(""), "");
});

test("newHashtagNames drops repeats ignoring case, keeping first spelling", () => {
  assert.deepEqual(newHashtagNames(["Quote", "QUOTE", "", "Climate"], ["climate"]), ["Quote"]);
});

test("excludedTagSet ignores case, spaces and punctuation, and bad settings", () => {
  assert.deepEqual([...excludedTagSet(["Site Updates", "pkm", 5])], ["siteupdates", "pkm"]);
  assert.equal(excludedTagSet("Meta").size, 0);
  assert.equal(excludedTagSet(undefined).size, 0);
});

test("isExcludedTag matches a tag's key or its label", () => {
  const excluded = excludedTagSet(["pkm", "site updates"]);
  assert.equal(isExcludedTag({ key: "pkm", label: "Personal Knowledge Management" }, excluded), true);
  assert.equal(isExcludedTag({ key: undefined, label: "SiteUpdates" }, excluded), true);
  assert.equal(isExcludedTag({ key: "climate", label: "Climate" }, excluded), false);
});

test("hashtagNamesFromTags leaves out excluded tags and repeats", () => {
  const tags = [
    { key: "pkm", label: "Personal Knowledge Management" },
    { key: "Climate", label: "Climate" },
    { key: "climate", label: "climate" },
    { key: "2026", label: "2026" },
  ];
  assert.deepEqual(hashtagNamesFromTags(tags, ["PKM"]), ["Climate"]);
  assert.deepEqual(hashtagNamesFromTags(tags, []), ["PersonalKnowledgeManagement", "Climate"]);
});

test("hasTitle is false only for missing or blank titles", () => {
  assert.equal(hasTitle("A post"), true);
  assert.equal(hasTitle("  "), false);
  assert.equal(hasTitle(""), false);
  assert.equal(hasTitle(undefined), false);
});

test("socialPostSettings falls back to {} when unset", () => {
  assert.deepEqual(socialPostSettings({ customFields: { socialPosts: { showResponses: false } } }), {
    showResponses: false,
  });
  assert.deepEqual(socialPostSettings({}), {});
  assert.deepEqual(socialPostSettings(undefined), {});
});

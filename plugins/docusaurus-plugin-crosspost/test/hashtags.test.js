/**
 * Tests for src/shared/hashtags.js and src/shared/posts.js.
 * Run with: npm test   (Node 22 or newer; Node's built-in test runner)
 * Docs: https://nodejs.org/api/test.html
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  comparisonForm,
  exceptSet,
  hashtagNamesFromTags,
  hashtagsIn,
  isExceptedTag,
  newHashtagNames,
  toHashtagName,
} from "../src/shared/hashtags.js";
import { hasTitle } from "../src/shared/posts.js";

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

test("comparisonForm treats spacing, case, punctuation and '#' alike", () => {
  for (const name of ["site updates", "Site Updates", "SiteUpdates", "#siteupdates"]) {
    assert.equal(comparisonForm(name), "siteupdates", name);
  }
});

test("exceptSet ignores case, spaces and punctuation, and bad settings", () => {
  assert.deepEqual([...exceptSet(["Site Updates", "pkm", 5])], ["siteupdates", "pkm"]);
  assert.equal(exceptSet("Meta").size, 0);
  assert.equal(exceptSet(undefined).size, 0);
});

test("isExceptedTag matches a tag's key or its label", () => {
  const excepted = exceptSet(["pkm", "site updates"]);
  assert.equal(isExceptedTag({ key: "pkm", label: "Personal Knowledge Management" }, excepted), true);
  assert.equal(isExceptedTag({ key: undefined, label: "SiteUpdates" }, excepted), true);
  assert.equal(isExceptedTag({ key: "climate", label: "Climate" }, excepted), false);
});

test("hashtagsIn finds hashtags but not numbers, URLs or character references", () => {
  assert.deepEqual(hashtagsIn("#Climate and #हिन्दी, #1, https://x.org/#frag, &#105;, C#, a#b"), ["Climate", "हिन्दी"]);
});

test("hashtagNamesFromTags leaves out excepted tags and repeats", () => {
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

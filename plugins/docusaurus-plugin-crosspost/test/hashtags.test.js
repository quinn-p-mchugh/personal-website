/**
 * Tests for src/shared/hashtags.js.
 * Run with: npm test   (Node 22 or newer; Node's built-in test runner)
 * Docs: https://nodejs.org/api/test.html
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  comparisonForm,
  hashtagNamesFromTags,
  hashtagsIn,
  isTagInSet,
  nameSet,
  newHashtagNames,
  toHashtagName,
} from "../src/shared/hashtags.js";

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
  for (const name of ["site updates", "Site Updates", "SiteUpdates", "#siteupdates", "##SiteUpdates", " #SiteUpdates "]) {
    assert.equal(comparisonForm(name), "siteupdates", name);
  }
});

test("nameSet ignores case, spaces, punctuation and '#', and bad settings", () => {
  assert.deepEqual([...nameSet(["Site Updates", "#pkm", 5])], ["siteupdates", "pkm"]);
  assert.equal(nameSet("Meta").size, 0);
  assert.equal(nameSet(undefined).size, 0);
});

test("isTagInSet matches a tag's key or its label", () => {
  const names = nameSet(["pkm", "#site updates"]);
  assert.equal(isTagInSet({ key: "pkm", label: "Personal Knowledge Management" }, names), true);
  assert.equal(isTagInSet({ key: null, label: "SiteUpdates" }, names), true);
  assert.equal(isTagInSet({ key: "climate", label: "Climate" }, names), false);
});

test("hashtagsIn finds hashtags but not numbers, URLs or character references", () => {
  assert.deepEqual(hashtagsIn("#Climate and #हिन्दी, #1, https://x.org/#frag, &#105;, C#, a#b"), ["Climate", "हिन्दी"]);
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

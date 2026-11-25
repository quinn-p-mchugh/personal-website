/**
 * Tests for src/shared/posts.js.
 * Run with: npm test   (Node's built-in test runner)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasTitle, postAddress, tagsWithKeys } from "../src/shared/posts.js";

test("hasTitle: only real text counts", () => {
  assert.equal(hasTitle("A"), true);
  assert.equal(hasTitle("  "), false);
  assert.equal(hasTitle(""), false);
  assert.equal(hasTitle(undefined), false);
});

test("postAddress applies trailingSlash like Docusaurus, keeping the baseUrl", () => {
  const site = { url: "https://example.com", baseUrl: "/site/" };
  assert.equal(postAddress("/site/blog/a", { ...site, trailingSlash: true }), "https://example.com/site/blog/a/");
  assert.equal(postAddress("/site/blog/a/", { ...site, trailingSlash: false }), "https://example.com/site/blog/a");
  assert.equal(postAddress("/site/blog/a", { ...site, trailingSlash: undefined }), "https://example.com/site/blog/a");
  assert.equal(postAddress("/site/", { ...site, trailingSlash: false }), "https://example.com/site/", "the base itself keeps its slash");
});

test("tagsWithKeys matches by label, not position", () => {
  const labels = new Map([["pkm", "Personal Knowledge Management"]]);
  const tags = tagsWithKeys(
    [{ label: "Climate" }, { label: "Personal Knowledge Management" }, { label: "Inline object" }],
    ["Climate", "Climate", "pkm", { label: "Inline object", permalink: "/x" }],
    labels
  );
  assert.deepEqual(tags, [
    { key: "Climate", label: "Climate" },
    { key: "pkm", label: "Personal Knowledge Management" },
    { key: null, label: "Inline object" },
  ]);
  assert.deepEqual(tagsWithKeys(undefined, undefined), []);
});

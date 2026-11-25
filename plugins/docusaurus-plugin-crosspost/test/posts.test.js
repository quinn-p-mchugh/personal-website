/**
 * Tests for src/shared/posts.js.
 * Run with: npm test   (Node 22 or newer; Node's built-in test runner)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasTitle, postDescription, postTags } from "../src/shared/posts.js";

test("hasTitle is false only for missing or blank titles", () => {
  assert.equal(hasTitle("A post"), true);
  assert.equal(hasTitle("  "), false);
  assert.equal(hasTitle(""), false);
  assert.equal(hasTitle(undefined), false);
});

test("postTags pairs Docusaurus's tags with how they were written", () => {
  const metadata = { tags: [{ label: "Personal Knowledge Management" }, { label: "Meta" }] };
  assert.deepEqual(postTags(metadata, { tags: ["pkm", { label: "Meta", permalink: "/meta" }] }), [
    { key: "pkm", label: "Personal Knowledge Management" },
    { key: null, label: "Meta" },
  ]);
  assert.deepEqual(postTags({ tags: [] }, undefined), []);
});

test("postDescription keeps only what the build steps need", () => {
  const metadata = {
    title: " A title ",
    source: "@site/blog/2026-11-24-a.md",
    permalink: "/blog/2026/11/24/a",
    date: "2026-11-24T00:00:00.000Z",
    unlisted: false,
    description: "Docusaurus's made-up excerpt",
    tags: [],
  };
  assert.deepEqual(postDescription(metadata, { description: " Mine " }), {
    title: "A title",
    description: "Mine",
    source: "@site/blog/2026-11-24-a.md",
    permalink: "/blog/2026/11/24/a",
    date: "2026-11-24T00:00:00.000Z",
    unlisted: false,
    tags: [],
  });
  assert.equal(postDescription({ ...metadata, title: "" }, {}).description, "", "Docusaurus's excerpt isn't used");
});

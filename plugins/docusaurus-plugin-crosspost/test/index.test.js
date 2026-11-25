/**
 * Tests for src/index.js's helpers.
 * Run with: npm test   (Node 22 or newer; Node's built-in test runner)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWarnings, headTags, usesHashRouter } from "../src/index.js";

test("the hash router is recognised", () => {
  assert.equal(usesHashRouter({ future: { experimental_router: "hash" } }), true);
  assert.equal(usesHashRouter({ future: { experimental_router: "browser" } }), false);
  assert.equal(usesHashRouter({}), false);
});

test("posts that couldn't be finished are explained, a few at a time", () => {
  const many = Array.from({ length: 7 }, (_, i) => `@site/blog/${i}.md`);
  const [markup, page] = buildWarnings({ withoutMarkup: many, withoutPage: ["@site/blog/x.md"] });
  assert.match(markup, /^7 post page\(s\) have no cross-posting markup.*4\.md, and 2 more\. .*src\/theme/);
  assert.match(page, /built page of 1 post\(s\).*x\.md/);
  assert.deepEqual(buildWarnings({ withoutMarkup: [], withoutPage: [] }), []);
});

test("head links: webmention only with a username; one rel=me per profile", () => {
  assert.deepEqual(headTags({ webmentionUsername: "", relMe: [] }), []);
  const tags = headTags({ webmentionUsername: "example.com", relMe: ["https://github.com/me"] });
  assert.equal(tags[0].attributes.href, "https://webmention.io/example.com/webmention");
  assert.deepEqual(tags[1].attributes, { rel: "me", href: "https://github.com/me" });
});

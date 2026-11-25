/**
 * Tests for src/options.js and the small helpers in src/index.js.
 * Run with: npm test   (Node 22 or newer; Node's built-in test runner)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { browserSettings, headTags } from "../src/index.js";
import { normalizeOptions } from "../src/options.js";

test("every setting has a default", () => {
  const options = normalizeOptions({});
  assert.deepEqual(options.networks, ["mastodon", "bluesky"]);
  assert.deepEqual(options.tagsToHashtags, { enabled: true, except: [] });
  assert.deepEqual(options.hashtagsToTags, { enabled: false, except: [] });
  assert.deepEqual(options.images, { enabled: true, resize: true, remote: true, maxBytes: 1_900_000, maxSide: 2000 });
  assert.equal(options.showResponses, true);
});

test("partial settings keep the other defaults", () => {
  const options = normalizeOptions({ images: { remote: false }, hashtagsToTags: { enabled: true } });
  assert.equal(options.images.resize, true);
  assert.equal(options.images.remote, false);
  assert.deepEqual(options.hashtagsToTags, { enabled: true, except: [] });
});

test("wrong settings are named in the error", () => {
  assert.throws(() => normalizeOptions({ networks: ["twitter"] }), /networks/);
  assert.throws(() => normalizeOptions({ tagsToHashtags: { except: "Meta" } }), /except/);
  assert.throws(() => normalizeOptions({ images: { maxBytes: 5_000_000 } }), /maxBytes/);
  assert.throws(() => normalizeOptions({ excludedTags: [] }), /excludedTags/, "old setting names are refused");
});

test("headTags adds the webmention link only when a username is set", () => {
  assert.deepEqual(headTags(normalizeOptions({})), []);
  const tags = headTags(normalizeOptions({ webmentionUsername: "example.com", relMe: ["https://github.com/me"] }));
  assert.deepEqual(tags.map((t) => t.attributes), [
    { rel: "webmention", href: "https://webmention.io/example.com/webmention" },
    { rel: "me", href: "https://github.com/me" },
  ]);
});

test("browserSettings shares only what the theme components need", () => {
  assert.deepEqual(Object.keys(browserSettings(normalizeOptions({}))).sort(), [
    "networks",
    "showResponses",
    "tagsToHashtags",
    "webmentionUsername",
  ]);
});

/**
 * Tests for src/options.js and the small helpers in src/index.js.
 * Run with: npm test   (Node's built-in test runner)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { browserSettings, headTags } from "../src/index.js";
import { normalizeOptions } from "../src/options.js";

test("every setting has a default", () => {
  const options = normalizeOptions({});
  assert.deepEqual(options.networks, ["mastodon", "bluesky"]);
  assert.deepEqual(options.tagsToHashtags, { enabled: true, excludedTags: [] });
  assert.deepEqual(options.hashtagsToTags, { enabled: false, excludedHashtags: [] });
  assert.deepEqual(options.images, {
    enabled: true,
    shrinkLargeImages: true,
    includeImagesFromOtherSites: true,
    maxFileSizeBytes: 1_900_000,
    maxWidthOrHeightPixels: 2000,
  });
  assert.deepEqual(options.socialPostTemplates, []);
  assert.equal(options.templatesPath, "crosspost-templates");
  assert.deepEqual(options.responses, {
    enabled: true,
    showLikes: true,
    showReposts: true,
    showReplies: true,
    maxAvatarsShown: 20,
    maxRepliesShown: null,
    replyOrder: "oldest",
    showQuotes: true,
    cacheMinutes: 5,
    showReplyButtons: true,
    headingLevel: 2,
  });
});

test("partial settings keep the other defaults", () => {
  const options = normalizeOptions({ images: { includeImagesFromOtherSites: false }, hashtagsToTags: { enabled: true } });
  assert.equal(options.images.shrinkLargeImages, true);
  assert.equal(options.images.includeImagesFromOtherSites, false);
  assert.deepEqual(options.hashtagsToTags, { enabled: true, excludedHashtags: [] });
});

test("hashtags and tags may be listed with or without '#'", () => {
  const options = normalizeOptions({ hashtagsToTags: { excludedHashtags: ["#TIL", "Quote"] } });
  assert.deepEqual(options.hashtagsToTags.excludedHashtags, ["#TIL", "Quote"]);
  assert.throws(() => normalizeOptions({ tagsToHashtags: { excludedTags: ["#"] } }), /no letters or digits/);
});

test("templates are checked: one text source, known placeholders, non-empty lists", () => {
  assert.doesNotThrow(() => normalizeOptions({ socialPostTemplates: [{ appliesTo: { blogs: ["blog"] }, template: "{title}\n{content}" }] }));
  assert.doesNotThrow(() => normalizeOptions({ socialPostTemplates: [{ templateFile: "notes.txt" }] }));
  assert.throws(() => normalizeOptions({ socialPostTemplates: [{ appliesTo: {} }] }), /needs "template"/);
  assert.throws(() => normalizeOptions({ socialPostTemplates: [{ template: "x", templateFile: "x.txt" }] }), /not both/);
  assert.throws(() => normalizeOptions({ socialPostTemplates: [{ template: "{titel}" }] }), /unknown placeholder\(s\) \{titel\}/);
  assert.throws(() => normalizeOptions({ socialPostTemplates: [{ appliesTo: { tags: [] }, template: "x" }] }), /tags/);
  assert.throws(() => normalizeOptions({ socialPostTemplates: [{ when: {}, template: "x" }] }), /when/, "old name refused");
});

test("wrong settings are named in the error", () => {
  assert.throws(() => normalizeOptions({ networks: ["twitter"] }), /networks/);
  assert.throws(() => normalizeOptions({ networks: [] }), /networks/);
  assert.throws(() => normalizeOptions({ tagsToHashtags: { excludedTags: "Meta" } }), /excludedTags/);
  assert.throws(() => normalizeOptions({ images: { maxFileSizeBytes: 5_000_000 } }), /maxFileSizeBytes/);
  assert.throws(() => normalizeOptions({ images: { resize: true } }), /resize/, "old names are refused");
  assert.throws(() => normalizeOptions({ relMe: ["javascript:alert(1)"] }), /relMe/);
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
  assert.deepEqual(Object.keys(browserSettings(normalizeOptions({}))).sort(), ["networks", "responses", "showSyndicationLinks", "webmentionUsername"]);
});

test("responses settings: limits are checked, and the old name is explained", () => {
  assert.equal(normalizeOptions({ responses: { maxAvatarsShown: 0 } }).responses.maxAvatarsShown, 0, "0 = counts only");
  assert.equal(normalizeOptions({ responses: { maxRepliesShown: 5 } }).responses.maxRepliesShown, 5);
  assert.throws(() => normalizeOptions({ responses: { maxRepliesShown: 0 } }), /maxRepliesShown/);
  assert.throws(() => normalizeOptions({ responses: { maxAvatarsShown: -1 } }), /maxAvatarsShown/);
  assert.equal(normalizeOptions({ responses: { replyOrder: "newest" } }).responses.replyOrder, "newest");
  assert.throws(() => normalizeOptions({ responses: { replyOrder: "random" } }), /replyOrder/);
  assert.throws(() => normalizeOptions({ responses: { headingLevel: 1 } }), /headingLevel/, "h1 is the page title");
  assert.throws(() => normalizeOptions({ showResponses: false }), /showResponses" was renamed: use responses\.enabled/);
});

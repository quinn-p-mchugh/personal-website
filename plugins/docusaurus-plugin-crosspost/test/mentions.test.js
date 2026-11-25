/**
 * Tests for src/components/SocialResponses/mentions.js.
 * Run with: npm test   (Node 22 or newer; Node's built-in test runner)
 * Docs: https://nodejs.org/api/test.html
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  authorOf,
  formatDate,
  groupMentions,
  initialOf,
  addressVariants,
  mentionsApiUrl,
  networkName,
  safeUrl,
  syndicationUrls,
} from "../src/components/SocialResponses/mentions.js";

test("safeUrl allows only http and https addresses", () => {
  assert.equal(safeUrl("https://a.social/@me"), "https://a.social/@me");
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert.equal(safeUrl("data:text/html,x"), null);
  assert.equal(safeUrl("not a url"), null);
  assert.equal(safeUrl(42), null);
});

test("networkName tells Bluesky from Mastodon", () => {
  assert.equal(networkName("https://bsky.app/profile/x/post/1"), "Bluesky");
  assert.equal(networkName("https://mastodon.social/@x/1"), "Mastodon");
  assert.equal(networkName("https://evilbsky.app/x"), "Mastodon", "look-alike host");
});

test("syndicationUrls accepts a list or one string and drops bad or repeated entries", () => {
  assert.deepEqual(syndicationUrls(["https://a/1", "https://a/1", "javascript:x", null]), ["https://a/1"]);
  assert.deepEqual(syndicationUrls("https://a/1"), ["https://a/1"]);
  assert.deepEqual(syndicationUrls(undefined), []);
});

test("mentionsApiUrl asks for the page with and without www and a trailing slash", () => {
  const url = new URL(mentionsApiUrl("https://site.org/blog/post/"));
  assert.deepEqual(url.searchParams.getAll("target[]"), [
    "https://site.org/blog/post/",
    "https://site.org/blog/post",
    "https://www.site.org/blog/post",
    "https://www.site.org/blog/post/",
  ]);
  assert.deepEqual(addressVariants("https://www.site.org/a"), [
    "https://www.site.org/a",
    "https://www.site.org/a/",
    "https://site.org/a",
    "https://site.org/a/",
  ]);
  assert.equal(url.searchParams.get("sort-dir"), "up");
});

test("authorOf falls back safely", () => {
  assert.deepEqual(authorOf({ name: " ", url: "https://p/me", photo: "javascript:x" }), {
    name: "https://p/me",
    url: "https://p/me",
    photo: null,
  });
  assert.equal(authorOf(null).name, "Someone");
});

test("groupMentions sorts, de-duplicates and filters responses", () => {
  const groups = groupMentions([
    { "wm-property": "like-of", url: "https://brid.gy/like/1" },
    { "wm-property": "like-of", url: "https://brid.gy/like/1" },
    { "wm-property": "repost-of", "wm-id": 9, "wm-received": "2026-11-23" },
    { "wm-property": "in-reply-to", url: "https://m/2", content: { text: " hi " } },
    { "wm-property": "mention-of", url: "https://m/3", content: {} },
    { "wm-property": "bookmark-of", url: "https://m/4" },
    { "wm-property": "like-of", url: "https://m/5", "wm-private": true },
    null,
    "junk",
  ]);
  assert.equal(groups.likes.length, 1);
  assert.equal(groups.reposts[0].published, "2026-11-23");
  assert.deepEqual(groups.replies.map((r) => r.text), ["hi"]);
  assert.deepEqual(groupMentions(undefined), { likes: [], reposts: [], replies: [] });
});

test("initialOf handles emoji and accents", () => {
  assert.equal(initialOf("😀 Bob"), "😀");
  assert.equal(initialOf("élan"), "É");
});

test("formatDate gives '' for missing or invalid dates", () => {
  assert.equal(formatDate("2026-11-24T12:00:00Z"), "Nov 24, 2026");
  assert.equal(formatDate(""), "");
  assert.equal(formatDate("nope"), "");
  assert.equal(formatDate("2026-11-24T12:00:00Z", "fr"), "24 nov. 2026", "the site's language");
  assert.equal(formatDate("2026-11-24T12:00:00Z", "not a tag!"), "Nov 24, 2026", "unknown tags fall back to English");
});

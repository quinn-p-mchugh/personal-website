/**
 * Tests for src/cli/liveSite.js. Requests are replaced with stand-ins.
 * Run with: npm test   (Node 22 or newer; Node's built-in test runner)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchManifest, manifestUrl, waitForPosts } from "../../src/cli/liveSite.js";

const manifest = (posts) => JSON.stringify({ version: 1, networks: ["mastodon"], blogs: [{ path: "blog", exclude: [] }], posts });

/** Runs a function with console.log silenced. */
async function quietly(fn) {
  const original = console.log;
  console.log = () => {};
  try {
    return await fn();
  } finally {
    console.log = original;
  }
}

test("manifestUrl keeps the site's base path", () => {
  assert.equal(manifestUrl("https://example.com"), "https://example.com/crosspost.json");
  assert.equal(manifestUrl("https://me.github.io/site"), "https://me.github.io/site/crosspost.json");
});

test("fetchManifest explains why a file can't be used", async () => {
  const get = (status, body) => async () => ({ status, body, location: "" });
  assert.match((await fetchManifest("https://x.org", get(404, ""))).problem, /HTTP 404/);
  assert.match((await fetchManifest("https://x.org", get(200, "<html>"))).problem, /valid JSON/);
  assert.match((await fetchManifest("https://x.org", get(200, '{"version":9}'))).problem, /version 1/);
  assert.equal((await fetchManifest("https://x.org", get(200, manifest([])))).manifest.networks[0], "mastodon");
});

test("waitForPosts waits until posts appear, then gives their addresses", async () => {
  const answers = [
    { status: 0, body: "down", location: "" },
    { status: 200, body: manifest([]), location: "" },
    { status: 200, body: manifest([{ source: "blog/a.md", url: "https://x.org/a" }]), location: "" },
  ];
  let sleeps = 0;
  const tools = { request: async () => answers.shift(), sleep: async () => (sleeps += 1) };
  const result = await quietly(() => waitForPosts(["blog/a.md"], "https://x.org", { waitMinutes: 5, checkEverySeconds: 1 }, tools));
  assert.deepEqual([...result.found], [["blog/a.md", "https://x.org/a"]]);
  assert.deepEqual(result.missing, []);
  assert.equal(sleeps, 2);
});

test("waitForPosts gives up when time runs out", async () => {
  const tools = { request: async () => ({ status: 200, body: manifest([]), location: "" }), sleep: async () => {} };
  const result = await quietly(() => waitForPosts(["blog/a.md"], "https://x.org", { waitMinutes: 0, checkEverySeconds: 1 }, tools));
  assert.deepEqual(result.missing, ["blog/a.md"]);
});

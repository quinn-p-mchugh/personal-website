/**
 * Tests for src/cli/send.js: whole runs, with the live site and Bridgy
 * replaced by stand-ins.
 * Run with: npm test   (Node 22 or newer; Node's built-in test runner)
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { sameAddress, send } from "../../src/cli/send.js";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "crosspost-send-"));
const startedIn = process.cwd();
after(() => {
  process.chdir(startedIn);
  fs.rmSync(root, { recursive: true, force: true });
});
process.chdir(root);
fs.mkdirSync("blog");
fs.writeFileSync("blog/2026-11-24-a.md", "---\ntitle: A\n---\nText\n");

const manifest = JSON.stringify({
  version: 1,
  networks: ["mastodon"],
  blogs: [{ path: "blog", exclude: [] }],
  posts: [{ source: "blog/2026-11-24-a.md", url: "https://x.org/blog/a" }],
});

/**
 * Builds stand-in tools: crosspost.json from the "site", and Bridgy's answer.
 *
 * Args:
 *     bridgyAnswer: What Bridgy answers each webmention.
 *
 * Returns:
 *     { request, sleep, sent }: sent lists the addresses sent to Bridgy.
 */
function fakeTools(bridgyAnswer) {
  const sent = [];
  return {
    sent,
    sleep: async () => {},
    request: async (url, form) => {
      if (form) {
        sent.push(form.source);
        return bridgyAnswer;
      }
      return { status: 200, body: manifest, location: "" };
    },
  };
}

/** Options for a run, with overrides. */
const options = (overrides) => ({
  siteUrl: "https://x.org",
  files: [],
  addedSince: "",
  addedInLastDays: 0,
  url: "",
  ignore: [],
  dryRun: false,
  saveSyndication: true,
  waitMinutes: 0,
  checkEverySeconds: 1,
  ...overrides,
});

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

test("a new post is sent and its address saved", async () => {
  const tools = fakeTools({ status: 201, body: "", location: "https://mastodon.social/@me/1" });
  const code = await quietly(() => send(options({ files: ["blog/2026-11-24-a.md", "README.md"] }), tools));
  assert.equal(code, 0);
  assert.deepEqual(tools.sent, ["https://x.org/blog/a"]);
  assert.match(fs.readFileSync("blog/2026-11-24-a.md", "utf8"), /syndication:\n {2}- https:\/\/mastodon\.social\/@me\/1/);
});

test("a dry run sends nothing", async () => {
  const tools = fakeTools({ status: 500, body: "", location: "" });
  assert.equal(await quietly(() => send(options({ files: ["blog/2026-11-24-a.md"], dryRun: true }), tools)), 0);
  assert.deepEqual(tools.sent, []);
});

test("a refusal or a post that never goes live fails the run", async () => {
  const refused = fakeTools({ status: 400, body: "No h-entry", location: "" });
  assert.equal(await quietly(() => send(options({ files: ["blog/2026-11-24-a.md"] }), refused)), 1);
  fs.writeFileSync("blog/2026-11-25-b.md", "---\n---\n");
  assert.equal(await quietly(() => send(options({ files: ["blog/2026-11-25-b.md"] }), fakeTools({ status: 201 }))), 1);
});

test("--url sends one address and finds its file", async () => {
  const tools = fakeTools({ status: 201, body: "", location: "https://bsky.app/profile/me/post/2" });
  assert.equal(await quietly(() => send(options({ url: "https://x.org/blog/a" }), tools)), 0);
  assert.deepEqual(tools.sent, ["https://x.org/blog/a"]);
  assert.match(fs.readFileSync("blog/2026-11-24-a.md", "utf8"), /bsky\.app/);
});

test("sameAddress ignores a trailing slash and a #section", () => {
  assert.equal(sameAddress("https://x.org/blog/a/", "https://x.org/blog/a"), true);
  assert.equal(sameAddress("https://x.org/blog/a#top", "https://x.org/blog/a"), true);
  assert.equal(sameAddress("https://x.org/blog/a", "https://x.org/blog/ab"), false);
});

test("no added files is a successful run", async () => {
  assert.equal(await quietly(() => send(options({ files: ["README.md"] }), fakeTools({ status: 201 }))), 0);
});

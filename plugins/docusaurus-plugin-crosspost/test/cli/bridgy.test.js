/**
 * Tests for src/cli/bridgy.js. No test contacts Bridgy: requests and
 * waits are replaced with stand-ins.
 * Run with: npm test   (Node 22 or newer; Node's built-in test runner)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BRIDGY_WEBMENTION_ENDPOINT, describeOutcome, isTemporaryFailure, sendToBridgy } from "../../src/cli/bridgy.js";

const answer = (status, body = "", location = "") => ({ status, body, location });

/**
 * Builds stand-in tools that give canned answers in turn.
 *
 * Args:
 *     answers: Responses to return, in order.
 *
 * Returns:
 *     { request, sleep, calls }: calls records each request's arguments.
 */
function fakeTools(answers) {
  const calls = [];
  return {
    calls,
    request: async (url, form) => (calls.push({ url, form }), answers.shift()),
    sleep: async () => {},
  };
}

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

test("temporary failures are retried; 'already publishing' isn't", () => {
  assert.equal(isTemporaryFailure(answer(0, "timeout")), true);
  assert.equal(isTemporaryFailure(answer(502)), true);
  assert.equal(isTemporaryFailure(answer(429, "slow down")), true);
  assert.equal(isTemporaryFailure(answer(429, "Already publishing")), false);
  assert.equal(isTemporaryFailure(answer(400, "bad")), false);
});

test("success and 'already published/publishing' all count as fine", () => {
  assert.equal(describeOutcome("m", answer(201, "", "https://x/1")).fine, true);
  assert.equal(describeOutcome("m", answer(400, "Already published: x")).fine, true);
  assert.equal(describeOutcome("m", answer(429, "already publishing")).fine, true);
  assert.equal(describeOutcome("m", answer(400, "No h-entry")).fine, false);
});

test("sendToBridgy retries, collects new addresses, and sends the right form", async () => {
  const tools = fakeTools([answer(503), answer(201, "", "https://m/1"), answer(201, "", "https://b/2")]);
  const result = await quietly(() => sendToBridgy("https://site/p", ["mastodon", "bluesky"], false, tools));
  assert.deepEqual(result, { fine: true, published: ["https://m/1", "https://b/2"] });
  assert.equal(tools.calls.length, 3);
  assert.deepEqual(tools.calls[0], { url: BRIDGY_WEBMENTION_ENDPOINT, form: { source: "https://site/p", target: "https://brid.gy/publish/mastodon" } });
  assert.equal(tools.calls[2].form.target, "https://brid.gy/publish/bluesky");
});

test("a dry run sends nothing; a refusal is reported", async () => {
  const dry = fakeTools([]);
  assert.deepEqual(await quietly(() => sendToBridgy("https://site/p", ["mastodon"], true, dry)), { fine: true, published: [] });
  assert.equal(dry.calls.length, 0);
  const refused = fakeTools([answer(400, "nope")]);
  assert.equal((await quietly(() => sendToBridgy("https://site/p", ["mastodon"], false, refused))).fine, false);
});

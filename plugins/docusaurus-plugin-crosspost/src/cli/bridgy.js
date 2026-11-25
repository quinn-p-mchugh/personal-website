/**
 * Asks Bridgy to publish a post to Mastodon and Bluesky.
 *
 * You tell Bridgy about a post by sending it a "webmention": a small web
 * request saying "this page exists, please publish it to Mastodon" (or
 * Bluesky). Bridgy reads the page, formats the post, publishes it, and
 * answers with the new post's address. Bridgy never publishes the same page
 * twice, so sending a post again is safe.
 * Docs: https://brid.gy/about
 * Tests: test/cli/bridgy.test.js
 */
import { BRIDGY_PUBLISH_TARGETS } from "../shared/names.js";
import { request as defaultRequest, short } from "./http.js";
import { say } from "./log.js";

/** Where Bridgy receives webmentions. Docs: https://brid.gy/about */
export const BRIDGY_WEBMENTION_ENDPOINT = "https://brid.gy/publish/webmention";

/** Tries per request that failed for a temporary reason, and the pause. */
export const BRIDGY_ATTEMPTS = 3;
export const BRIDGY_RETRY_SECONDS = 20;

/**
 * Bridgy's wording for a page it has published before, and for a page it's
 * publishing in another request right now (from Bridgy's publish.py).
 */
const ALREADY_PUBLISHED = "already published";
const ALREADY_PUBLISHING = "already publishing";

/**
 * Tells whether a failed request is worth trying again.
 *
 * Args:
 *     response: { status, body } from request.
 *
 * Returns:
 *     True for no answer, HTTP 5xx and rate limits, except Bridgy's
 *     "already publishing" 429, which means another request has it in hand.
 */
export function isTemporaryFailure(response) {
  if (response.status === 429) return !response.body.toLowerCase().includes(ALREADY_PUBLISHING);
  return response.status === 0 || response.status >= 500;
}

/**
 * Turns Bridgy's answer into a pass or fail and a log line.
 *
 * Args:
 *     network: The network's name, e.g. "mastodon".
 *     response: { status, body, location } from request.
 *
 * Returns:
 *     { fine, line }: fine is true if nothing more needs doing.
 */
export function describeOutcome(network, response) {
  const body = response.body.toLowerCase();
  if (response.status >= 200 && response.status < 300) {
    return { fine: true, line: `  sent    ${network}: ${response.location || "accepted"}` };
  }
  if (body.includes(ALREADY_PUBLISHED)) {
    return { fine: true, line: `  ok      ${network}: already published earlier, nothing to do` };
  }
  if (response.status === 429 && body.includes(ALREADY_PUBLISHING)) {
    return { fine: true, line: `  ok      ${network}: Bridgy is already publishing this right now` };
  }
  return { fine: false, line: `  FAILED  ${network} (HTTP ${response.status}): ${short(response.body)}` };
}

/**
 * Asks Bridgy to publish one post to one network, retrying blips.
 *
 * Args:
 *     postUrl: The post's live address.
 *     network: A key of BRIDGY_PUBLISH_TARGETS.
 *     tools: { request, sleep }, replaceable in tests.
 *
 * Returns:
 *     A promise of Bridgy's final answer.
 */
export async function sendWebmention(postUrl, network, tools) {
  const form = { source: postUrl, target: BRIDGY_PUBLISH_TARGETS[network] };
  let response = await tools.request(BRIDGY_WEBMENTION_ENDPOINT, form);
  for (let attempt = 2; attempt <= BRIDGY_ATTEMPTS && isTemporaryFailure(response); attempt += 1) {
    say(`  retry   Bridgy answered HTTP ${response.status}; trying again in ${BRIDGY_RETRY_SECONDS}s (attempt ${attempt} of ${BRIDGY_ATTEMPTS})`);
    await tools.sleep(BRIDGY_RETRY_SECONDS * 1000);
    response = await tools.request(BRIDGY_WEBMENTION_ENDPOINT, form);
  }
  return response;
}

/**
 * Asks Bridgy to publish one post to every network.
 *
 * Args:
 *     postUrl: The post's live address.
 *     networks: Network names, e.g. ["mastodon", "bluesky"].
 *     dryRun: If true, only print what would be sent.
 *     tools: { request, sleep }; defaults to real requests and waits.
 *
 * Returns:
 *     A promise of { fine, published }: fine is true if every network
 *     published the post, had already, or was skipped by the dry run;
 *     published lists the new posts' addresses, in network order.
 */
export async function sendToBridgy(postUrl, networks, dryRun, tools = defaultTools()) {
  let fine = true;
  const published = [];
  for (const network of networks) {
    if (dryRun) {
      say(`  dry run would send ${postUrl} to ${network}`);
      continue;
    }
    const response = await sendWebmention(postUrl, network, tools);
    const outcome = describeOutcome(network, response);
    say(outcome.line);
    fine = fine && outcome.fine;
    const created = response.status >= 200 && response.status < 300;
    if (created && /^https?:\/\//.test(response.location)) published.push(response.location);
  }
  return { fine, published };
}

/**
 * The real request and wait functions.
 *
 * Returns:
 *     { request, sleep }.
 */
export function defaultTools() {
  return { request: defaultRequest, sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) };
}

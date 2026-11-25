/**
 * Reads the live site's crosspost.json, written by the plugin at each
 * build (src/postPages.js), and waits for new posts to appear in it.
 *
 * Waiting for the live site, not for a hosting provider's "deployed"
 * signal, works the same on Vercel, Netlify, Cloudflare or GitHub Pages:
 * a post is ready when its page is live, and only then can Bridgy read it.
 * Tests: test/cli/liveSite.test.js
 */
import { MANIFEST_FILE, MANIFEST_VERSION } from "../postPages.js";
import { say } from "./log.js";

/**
 * Works out crosspost.json's address.
 *
 * Args:
 *     siteUrl: The site's address, including any base path, e.g.
 *         "https://example.com" or "https://example.github.io/my-site/".
 *
 * Returns:
 *     The address of crosspost.json.
 */
export function manifestUrl(siteUrl) {
  return new URL(MANIFEST_FILE, siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`).href;
}

/**
 * Fetches and checks crosspost.json, never throwing.
 *
 * Args:
 *     siteUrl: The site's address.
 *     request: The request function (see http.js).
 *
 * Returns:
 *     A promise of { manifest, problem }: the parsed file, or null with
 *     the reason it couldn't be used.
 */
export async function fetchManifest(siteUrl, request) {
  const url = `${manifestUrl(siteUrl)}?t=${Date.now()}`; // skip stale caches
  const response = await request(url);
  if (response.status !== 200) return { manifest: null, problem: `${manifestUrl(siteUrl)} answered HTTP ${response.status}` };
  try {
    const manifest = JSON.parse(response.body);
    if (manifest.version !== MANIFEST_VERSION || !Array.isArray(manifest.posts) || !Array.isArray(manifest.blogs)) {
      return { manifest: null, problem: `${manifestUrl(siteUrl)} isn't a version ${MANIFEST_VERSION} crosspost.json` };
    }
    return { manifest, problem: null };
  } catch {
    return { manifest: null, problem: `${manifestUrl(siteUrl)} isn't valid JSON` };
  }
}

/**
 * Waits until the live site lists some post files.
 *
 * Args:
 *     files: Post files, as paths relative to the repository root.
 *     siteUrl: The site's address.
 *     timing: { waitMinutes, checkEverySeconds }.
 *     tools: { request, sleep }.
 *
 * Returns:
 *     A promise of { found, missing, manifest }: found maps each live file
 *     to its address; missing lists files still not live when time ran
 *     out; manifest is the last crosspost.json read (or null).
 */
export async function waitForPosts(files, siteUrl, timing, tools) {
  const deadline = Date.now() + timing.waitMinutes * 60_000;
  let manifest = null;
  for (;;) {
    const result = await fetchManifest(siteUrl, tools.request);
    manifest = result.manifest || manifest;
    const live = new Map((manifest?.posts || []).map((post) => [post.source, post.url]));
    const found = new Map(files.filter((file) => live.has(file)).map((file) => [file, live.get(file)]));
    const missing = files.filter((file) => !live.has(file));
    if (!missing.length || Date.now() >= deadline) return { found, missing, manifest };
    say(`  waiting for ${missing.length} post(s) to go live${result.problem ? ` (${result.problem})` : ""}...`);
    await tools.sleep(timing.checkEverySeconds * 1000);
  }
}

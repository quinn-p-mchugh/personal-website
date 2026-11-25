/**
 * The "send" command: tells Bridgy about new blog posts, so it cross-posts
 * them to Mastodon and Bluesky, and saves where they went.
 *
 * Steps:
 * 1. Find the files added since a commit, in the last few days, or given
 *    by name (src/cli/addedFiles.js).
 * 2. Keep the ones that are posts to publish (src/cli/posts.js), using the
 *    blogs listed in the live site's crosspost.json.
 * 3. Wait until each is live, by its entry in crosspost.json
 *    (src/cli/liveSite.js), which also gives its exact address.
 * 4. Send each to Bridgy (src/cli/bridgy.js), to the networks the site's
 *    plugin settings name.
 * 5. Optionally save the new Mastodon and Bluesky addresses into each post
 *    file (src/cli/syndication.js); committing them is left to the caller.
 *
 * Bridgy never publishes the same page twice, so running this again is
 * safe. Docs: https://brid.gy/about
 * Tests: test/cli/send.test.js
 */
import { filesAddedInLastDays, filesAddedSince } from "./addedFiles.js";
import { defaultTools, sendToBridgy } from "./bridgy.js";
import { fetchManifest, waitForPosts } from "./liveSite.js";
import { reportError, say } from "./log.js";
import { skipReason } from "./posts.js";
import { saveSyndication } from "./syndication.js";

/**
 * Tells whether two web addresses name the same page, ignoring a trailing
 * slash and a "#section" (Docusaurus serves "/post" and "/post/" alike).
 *
 * Args:
 *     a: A web address.
 *     b: Another web address.
 *
 * Returns:
 *     True if they name the same page.
 */
export function sameAddress(a, b) {
  const tidy = (address) => String(address).replace(/#.*$/, "").replace(/\/+$/, "");
  return tidy(a) === tidy(b);
}

/**
 * Lists the files a run should consider.
 *
 * Args:
 *     options: The command's options (see main.js).
 *
 * Returns:
 *     Paths relative to the site folder (where the command runs).
 */
export function candidateFiles(options) {
  if (options.files.length) return options.files;
  if (options.addedInLastDays) return filesAddedInLastDays(options.addedInLastDays);
  return filesAddedSince(options.addedSince);
}

/**
 * Picks the post files to send from a list of added files.
 *
 * Args:
 *     files: Added files.
 *     blogs: { path, exclude } for each blog, from crosspost.json.
 *     ignore: The --ignore patterns.
 *
 * Returns:
 *     A promise of the files to send. Skipped blog files are printed with
 *     the reason.
 */
export async function postsToSend(files, blogs, ignore) {
  const posts = [];
  for (const file of files) {
    const reason = await skipReason(file, blogs, ignore);
    if (reason === null) posts.push(file);
    else if (reason) say(`  skip    ${file}: ${reason}`);
  }
  return posts;
}

/**
 * Sends one post and, if asked, saves where it went.
 *
 * Args:
 *     file: The post file, or null when only the address is known.
 *     url: The post's live address.
 *     networks: Network names from crosspost.json.
 *     options: The command's options.
 *     tools: { request, sleep }.
 *
 * Returns:
 *     A promise of a problem to report, or null if it all worked.
 */
export async function sendPost(file, url, networks, options, tools) {
  say(`Post: ${url}`);
  const { fine, published } = await sendToBridgy(url, networks, options.dryRun, tools);
  if (options.saveSyndication && file && !options.dryRun) await saveSyndication(file, published);
  return fine ? null : `Bridgy didn't accept ${url}; see the FAILED lines above.`;
}

/**
 * Runs the "send" command.
 *
 * Args:
 *     options: { siteUrl, files, addedSince, addedInLastDays, url, ignore,
 *         dryRun, saveSyndication, waitMinutes, checkEverySeconds }.
 *     tools: { request, sleep }; real ones by default.
 *
 * Returns:
 *     A promise of the exit code: 0 if everything worked, 1 if not.
 */
export async function send(options, tools = defaultTools()) {
  const problems = [];
  const timing = { waitMinutes: options.waitMinutes, checkEverySeconds: options.checkEverySeconds };

  if (options.url) {
    const { manifest, problem } = await fetchManifest(options.siteUrl, tools.request);
    if (!manifest) {
      reportError(`Can't read the site's crosspost.json (${problem}).`);
      return 1;
    }
    const entry = manifest.posts.find((post) => sameAddress(post.url, options.url));
    if (!entry) say(`  note    ${options.url} isn't listed in crosspost.json; addresses won't be saved`);
    const problemForPost = await sendPost(entry ? entry.source : null, options.url, manifest.networks, options, tools);
    if (problemForPost) problems.push(problemForPost);
  } else {
    const files = candidateFiles(options);
    // Only Markdown files can be posts; listing images and code too is noise.
    const markdown = files.filter((file) => /\.mdx?$/i.test(file));
    say(`Added files: ${files.length}, of which Markdown: ${markdown.length ? markdown.join(", ") : "none"}`);
    if (!files.length) return 0;
    const { manifest, problem } = await fetchManifest(options.siteUrl, tools.request);
    if (!manifest) {
      reportError(`Can't read the site's crosspost.json (${problem}). Is the site built with docusaurus-plugin-crosspost?`);
      return 1;
    }
    const posts = await postsToSend(files, manifest.blogs, options.ignore);
    if (!posts.length) {
      say("No new posts to send.");
      return 0;
    }
    say(`Waiting for ${posts.length} post(s) to go live on ${options.siteUrl} ...`);
    const live = await waitForPosts(posts, options.siteUrl, timing, tools);
    for (const file of live.missing) {
      problems.push(`${file} wasn't live after ${options.waitMinutes} minutes. Check the deploy, then run again with --url and the post's address.`);
    }
    const networks = (live.manifest || manifest).networks;
    for (const [file, url] of live.found) {
      const problemForPost = await sendPost(file, url, networks, options, tools);
      if (problemForPost) problems.push(problemForPost);
    }
  }

  problems.forEach(reportError);
  return problems.length ? 1 : 0;
}

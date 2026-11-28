/**
 * Labels for blog posts without a title, like microblog posts.
 *
 * Docusaurus shows a post's title in the sidebar, the browser tab and the
 * RSS feeds, so an untitled post (title: "") shows nothing there. This
 * gives each untitled post a label made of its date and first words, like
 * "Nov 13, 2026: Building a data biography…", without giving it a title:
 * an untitled post still cross-posts in full, and still has no heading.
 *
 * Used by every blog in docusaurus.config.js:
 * - processBlogPosts sets the sidebar label (front matter sidebar_label)
 *   and the browser tab title (title_meta);
 *   Docs: https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog#processBlogPosts
 *         https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog#markdown-front-matter
 * - feedOptions.createFeedItems gives feed items the same label.
 *   Docs: https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog#feed
 * The list pages and post pages are handled by src/theme/BlogPostItem/Header.
 */

/** Longest excerpt, in characters, before it is cut at a word. */
const EXCERPT_LENGTH = 40;

/** Quote marks and spaces a post's text may start or end with. */
const EDGE_QUOTES = /^["'“”‘’\s]+|["'“”‘’\s]+$/g;

/**
 * Formats a post's date like Docusaurus's own blog dates (in UTC), but
 * short and with a two-digit day: "Nov 13, 2026", "Nov 01, 2026".
 *
 * Args:
 *     date: The post's date (a Date or an ISO 8601 string).
 *
 * Returns:
 *     The date as text.
 */
function shortDate(date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(date));
}

/** Shortest first clause, in characters, worth ending the excerpt at. */
const SHORTEST_CLAUSE = 20;

/** Small words that read badly at the end of an excerpt ("...a…"). */
const TRAILING_SMALL_WORDS = /(?:\s+(?:a|an|and|as|at|by|for|from|in|into|is|of|on|or|the|to|with))+$/i;

/**
 * Cuts text at the last whole word that fits in EXCERPT_LENGTH.
 *
 * Args:
 *     text: Text longer than EXCERPT_LENGTH.
 *
 * Returns:
 *     The start of the text, ending at a word.
 */
function cutAtWord(text) {
  const cut = text.slice(0, EXCERPT_LENGTH + 1);
  return cut.includes(" ") ? cut.slice(0, cut.lastIndexOf(" ")) : cut.slice(0, EXCERPT_LENGTH);
}

/**
 * Ends a cut at its first clause (before a comma, colon, dash and so on)
 * when that clause is long enough to make sense alone.
 *
 * Args:
 *     cut: The start of the text, from cutAtWord.
 *
 * Returns:
 *     The first clause, or the cut unchanged.
 */
function firstClause(cut) {
  const match = /[,;:.!?]\s|\s[—–-]\s/.exec(cut);
  return match && match.index >= SHORTEST_CLAUSE ? cut.slice(0, match.index) : cut;
}

/**
 * Shortens text to about EXCERPT_LENGTH characters, at a word.
 *
 * Args:
 *     text: Any text.
 *
 * Returns:
 *     The text without surrounding quote marks or a trailing comma or
 *     colon. When it was longer than
 *     EXCERPT_LENGTH, it is cut at its first clause or last whole word,
 *     without trailing small words or punctuation, and ends with "…".
 */
function excerpt(text) {
  const clean = text.replace(/\s+/g, " ").replace(EDGE_QUOTES, "");
  // A colon or comma at the end (like "Three subreddits:") leads nowhere.
  if (clean.length <= EXCERPT_LENGTH) return clean.replace(/\s*[,;:—–-]+$/, "");
  const short = firstClause(cutAtWord(clean)).replace(/[\s,.;:!?—–-]+$/, "").replace(TRAILING_SMALL_WORDS, "");
  return `${short}…`;
}

/**
 * Makes the label for an untitled post.
 *
 * Args:
 *     date: The post's date.
 *     description: The post's description; Docusaurus uses the start of
 *         the post when the front matter has none.
 *
 * Returns:
 *     "Nov 13, 2026: Building a data biography…", or only the date when
 *     there is no description.
 */
function untitledLabel(date, description) {
  const words = excerpt(description || "");
  return words ? `${shortDate(date)}: ${words}` : shortDate(date);
}

/**
 * Tells whether a blog post has no title.
 *
 * Args:
 *     metadata: The post's metadata, from Docusaurus.
 *
 * Returns:
 *     true when the title is empty or only spaces.
 */
function isUntitled(metadata) {
  return !metadata.title || metadata.title.trim() === "";
}

/**
 * Gives each untitled post a sidebar label and a browser tab title.
 * Labels set in a post's own front matter are kept.
 *
 * Args:
 *     options: { blogPosts } from Docusaurus.
 *
 * Returns:
 *     A promise of the posts (changed in place).
 */
async function labelUntitledPosts({ blogPosts }) {
  for (const { metadata } of blogPosts) {
    if (!isUntitled(metadata)) continue;
    const label = untitledLabel(metadata.date, metadata.description);
    metadata.frontMatter.sidebar_label ??= label;
    metadata.frontMatter.title_meta ??= label;
  }
  return blogPosts;
}

/**
 * Makes feed items, giving untitled posts their label as the item's title.
 *
 * Args:
 *     options: { blogPosts, defaultCreateFeedItems, ... } from Docusaurus.
 *
 * Returns:
 *     A promise of the feed items.
 */
async function createFeedItems(options) {
  const items = await options.defaultCreateFeedItems(options);
  const labels = new Map(
    options.blogPosts.filter(({ metadata }) => isUntitled(metadata)).map(({ metadata }) => [metadata.permalink, metadata.frontMatter.title_meta])
  );
  for (const item of items) {
    if (item.title) continue;
    const link = item.link.replace(/\/$/, "");
    const permalink = [...labels.keys()].find((candidate) => link.endsWith(candidate.replace(/\/$/, "")));
    if (permalink) item.title = labels.get(permalink);
  }
  return items;
}

module.exports = { createFeedItems, excerpt, labelUntitledPosts, shortDate, untitledLabel };

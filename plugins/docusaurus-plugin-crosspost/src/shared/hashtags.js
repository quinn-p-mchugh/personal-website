/**
 * Hashtag rules shared by every part of the plugin, so they all agree:
 * - src/remarkHashtags.js (while building, for untitled posts),
 * - src/hashtagsToTags.js (while building, for site tags),
 * - src/theme/BlogPostItem/Container (in the page, for titled posts).
 * Runs both in Node and in the browser, so it uses no Node modules.
 * Tests: test/hashtags.test.js
 */

/**
 * Characters a hashtag name may contain: letters, the accent and vowel marks
 * that combine with them (as in Hindi or Thai), digits, and "_". Mastodon
 * uses the same set.
 * Docs: https://docs.joinmastodon.org/user/posting/#hashtags
 */
export const HASHTAG_CHARACTER = "[\\p{L}\\p{M}\\p{N}_]";

/**
 * Matches a hashtag: "#" then hashtag characters, not inside a word, a URL
 * or an HTML character reference like "&#105;". Group 2 is the name.
 */
const HASHTAG = new RegExp(`(^|[^\\p{L}\\p{M}\\p{N}_&/#])#(${HASHTAG_CHARACTER}+)`, "gu");

/**
 * Finds the hashtags in some text.
 *
 * Args:
 *     text: Plain text.
 *
 * Returns:
 *     Hashtag names without "#", in order of appearance, e.g. ["Quote"].
 *     All-digit names like "1" are left out, as Mastodon does.
 */
export function hashtagsIn(text) {
  return [...String(text).matchAll(HASHTAG)]
    .map((match) => match[2])
    .filter((name) => !/^\p{N}+$/u.test(name)); // "#1" is a number, not a hashtag
}

/**
 * Converts a tag label to a hashtag name.
 *
 * Words are split on anything that isn't a letter, mark or digit, and each
 * word's first letter is capitalized, so "animal welfare" becomes
 * "AnimalWelfare" and "AI ethics" becomes "AIEthics". Same rule as the
 * Readwise script.
 *
 * Args:
 *     label: A tag label, e.g. "Personal Knowledge Management (PKM)".
 *
 * Returns:
 *     The hashtag name without "#". "" if the label has no letters or digits,
 *     or only digits, since "#2026" is a number, not a hashtag, on Mastodon.
 */
export function toHashtagName(label) {
  const name = String(label)
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join("");
  return /^\p{N}*$/u.test(name) ? "" : name;
}

/**
 * Gives the form two names are compared in: hashtag form, lower case.
 *
 * So "site updates", "Site Updates", "SiteUpdates" and "#siteupdates" all
 * count as the same name, wherever names are compared.
 *
 * Args:
 *     name: A tag key, tag label or hashtag name, with or without "#".
 *
 * Returns:
 *     The comparison form; "" if the name can't be a hashtag.
 */
export function comparisonForm(name) {
  return toHashtagName(String(name).replace(/^#/, "")).toLowerCase();
}

/**
 * Removes repeats from a list of hashtag names, ignoring letter case.
 *
 * Args:
 *     names: Hashtag names without "#".
 *     alreadyUsed: Names to treat as repeats too, e.g. those in the post.
 *
 * Returns:
 *     The names that are new, in their original order and spelling. Empty
 *     names are dropped.
 */
export function newHashtagNames(names, alreadyUsed = []) {
  const seen = new Set(alreadyUsed.map((name) => name.toLowerCase()));
  return names.filter((name) => {
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Builds a lookup from an "except" list, for fast checks.
 *
 * Args:
 *     except: An "except" setting, e.g. ["Meta", "TIL"]. Anything that
 *         isn't a list of strings is treated as an empty list.
 *
 * Returns:
 *     A Set of names in comparison form.
 */
export function exceptSet(except) {
  const entries = Array.isArray(except) ? except.filter((name) => typeof name === "string") : [];
  return new Set(entries.map(comparisonForm).filter(Boolean));
}

/**
 * Tells whether a tag is on an "except" list.
 *
 * Args:
 *     tag: { key, label }: the tag as written in front matter (a tags file
 *         key or a plain label; undefined for a tag written as an object),
 *         and the label Docusaurus shows.
 *     excepted: A Set from exceptSet.
 *
 * Returns:
 *     True if the tag's key or its label matches an entry.
 */
export function isExceptedTag(tag, excepted) {
  return [tag.key, tag.label].some((form) => typeof form === "string" && excepted.has(comparisonForm(form)));
}

/**
 * Converts a post's tags to hashtag names, for its social posts.
 *
 * Args:
 *     tags: { key, label } for each of the post's tags, in order.
 *     except: The tagsToHashtags.except setting.
 *
 * Returns:
 *     Hashtag names without "#", without repeats or excepted tags,
 *     e.g. ["Climate", "AIEthics"].
 */
export function hashtagNamesFromTags(tags, except) {
  const excepted = exceptSet(except);
  return newHashtagNames(tags.filter((tag) => !isExceptedTag(tag, excepted)).map((tag) => toHashtagName(tag.label)));
}

/**
 * Turns Docusaurus tags into hashtags for social posts.
 *
 * Shared by plugins/remark-social-hashtags.mjs (build time) and
 * src/theme/BlogPostItem/Container (page rendering), so both use the same rule.
 */

/**
 * Characters a hashtag name may contain: letters, the accent and vowel marks
 * that combine with them (as in Hindi or Thai), digits, and "_". Mastodon
 * uses the same set. Shared with plugins/remark-social-hashtags.mjs.
 * Docs: https://docs.joinmastodon.org/user/posting/#hashtags
 */
export const HASHTAG_CHARACTER = "[\\p{L}\\p{M}\\p{N}_]";

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
 * Builds a lookup of the tags that must never become hashtags.
 *
 * Entries are compared in hashtag form, ignoring case, so "site updates",
 * "Site Updates" and "SiteUpdates" are the same entry.
 *
 * Args:
 *     excludedTags: The socialPosts.excludedTags setting; anything that
 *         isn't a list of strings is treated as an empty list.
 *
 * Returns:
 *     A Set of lowercase hashtag names.
 */
export function excludedTagSet(excludedTags) {
  const entries = Array.isArray(excludedTags) ? excludedTags.filter((tag) => typeof tag === "string") : [];
  return new Set(entries.map((tag) => toHashtagName(tag).toLowerCase()).filter(Boolean));
}

/**
 * Tells whether a tag is on the excluded list.
 *
 * Args:
 *     tag: { key, label }: the tag as written in front matter (a tags file
 *         key or a plain label; undefined for a tag written as an object),
 *         and the label Docusaurus shows.
 *     excluded: A Set from excludedTagSet.
 *
 * Returns:
 *     True if the tag's key or label matches an excluded entry.
 */
export function isExcludedTag(tag, excluded) {
  return [tag.key, tag.label].some(
    (form) => typeof form === "string" && excluded.has(toHashtagName(form).toLowerCase())
  );
}

/**
 * Converts a post's tags to hashtag names, leaving out excluded tags.
 *
 * Args:
 *     tags: { key, label } for each of the post's tags, in order.
 *     excludedTags: The socialPosts.excludedTags setting.
 *
 * Returns:
 *     Hashtag names without "#", without repeats, e.g. ["Climate", "AIEthics"].
 */
export function hashtagNamesFromTags(tags, excludedTags) {
  const excluded = excludedTagSet(excludedTags);
  return newHashtagNames(tags.filter((tag) => !isExcludedTag(tag, excluded)).map((tag) => toHashtagName(tag.label)));
}

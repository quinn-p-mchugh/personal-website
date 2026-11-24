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
 * Converts tag labels to hashtag names, without repeats.
 *
 * Args:
 *     labels: Tag labels, e.g. ["Climate", "AI ethics"].
 *
 * Returns:
 *     Hashtag names without "#", e.g. ["Climate", "AIEthics"].
 */
export function hashtagNamesFromLabels(labels) {
  return newHashtagNames(labels.map(toHashtagName));
}

/**
 * Rules about blog posts shared by the theme components and the build steps,
 * so they all agree. Runs both in Node and in the browser.
 * Tests: test/posts.test.js
 */
import * as utilsCommon from "@docusaurus/utils-common";

// The same helper Docusaurus's own links and feeds use. The package is
// CommonJS: Node puts its functions on "default", while webpack and the
// loader Docusaurus uses for config files put them on the module itself.
const applyTrailingSlash = utilsCommon.applyTrailingSlash ?? utilsCommon.default.applyTrailingSlash;

/**
 * Tells whether a post has a visible title.
 *
 * Bridgy posts a titled post as "Title: link" and an untitled one in full,
 * so every part of the plugin must agree on which posts count as titled.
 *
 * Args:
 *     title: The post's title from Docusaurus metadata; may be "".
 *
 * Returns:
 *     True if the title has any non-space characters.
 */
export function hasTitle(title) {
  return typeof title === "string" && title.trim() !== "";
}

/**
 * Works out a post's full public address, the way Docusaurus does.
 *
 * Docusaurus's permalinks have no trailing slash; the site's trailingSlash
 * setting decides whether the live address has one. Docusaurus's own blog
 * feed applies it the same way (applyTrailingSlash), so Bridgy, the feed
 * and the "send" command all see one address per post.
 * Docs: https://docusaurus.io/docs/api/docusaurus-config#trailingSlash
 *
 * Args:
 *     permalink: The post's permalink, e.g. "/blog/my-post" (includes the
 *         baseUrl).
 *     site: { url, baseUrl, trailingSlash } from the Docusaurus config
 *         (baseUrl as for the current language).
 *
 * Returns:
 *     The address, e.g. "https://example.com/blog/my-post/".
 */
export function postAddress(permalink, site) {
  const path = applyTrailingSlash(permalink, { trailingSlash: site.trailingSlash, baseUrl: site.baseUrl });
  return new URL(path, site.url).href;
}

/**
 * Pairs each of a post's tags with the way it was written in front matter.
 *
 * A front matter tag is either a key from the blog's tags file (shown with
 * that file's label) or a label written inline. Matching by label, not by
 * position, stays right when Docusaurus drops a repeated tag. The key is
 * what lets tagsToHashtags.excludedTags match a tags-file key as well as
 * a label.
 *
 * Args:
 *     metadataTags: The post's tags from Docusaurus metadata ({ label }).
 *     frontMatterTags: The post's front matter "tags", as written.
 *     tagLabels: Map of tags-file keys to labels (see readTagLabels).
 *
 * Returns:
 *     { key, label } for each tag: key is the front matter string that
 *     produced the tag, or null for a tag written as an object.
 */
export function tagsWithKeys(metadataTags, frontMatterTags, tagLabels = new Map()) {
  const keyForLabel = new Map();
  for (const written of Array.isArray(frontMatterTags) ? frontMatterTags : []) {
    if (typeof written !== "string") continue;
    const label = tagLabels.get(written) ?? written;
    if (!keyForLabel.has(label)) keyForLabel.set(label, written);
  }
  return (metadataTags || [])
    .filter((tag) => tag && typeof tag.label === "string")
    .map((tag) => ({ key: keyForLabel.get(tag.label) ?? null, label: tag.label }));
}

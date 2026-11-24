/**
 * Small helpers shared by the blog post theme wrappers in
 * src/theme/BlogPostItem, so they all apply the same rules.
 * Tests: tests/social-posts/hashtags.test.mjs (run with npm test).
 */

/**
 * Tells whether a post has a visible title.
 *
 * Bridgy posts a titled post as "Title: link" and an untitled one in full,
 * so every part of the site must agree on which posts count as titled.
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
 * Reads the socialPosts settings from the site config.
 *
 * Args:
 *     siteConfig: The Docusaurus site config, from useDocusaurusContext().
 *
 * Returns:
 *     The socialPosts object from customFields in docusaurus.config.js, or
 *     {} if it isn't set, so every setting falls back to its default.
 */
export function socialPostSettings(siteConfig) {
  const customFields = (siteConfig && siteConfig.customFields) || {};
  return customFields.socialPosts || {};
}

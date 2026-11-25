/**
 * Rules about blog posts shared by the theme components and the build steps,
 * so they all agree. Runs both in Node and in the browser.
 * Tests: test/hashtags.test.js
 */

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

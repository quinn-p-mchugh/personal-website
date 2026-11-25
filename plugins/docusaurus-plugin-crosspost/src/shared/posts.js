/**
 * Rules about blog posts shared by the theme components and the build steps,
 * so they all agree. Runs both in Node and in the browser.
 * Tests: test/posts.test.js
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

/**
 * Pairs each of a post's tags with the way it was written in front matter.
 *
 * Docusaurus builds metadata.tags from front matter tags one for one, in the
 * same order, so the same position gives the same tag. The key is what lets
 * tagsToHashtags.excludedTags match a tags-file key as well as a label.
 *
 * Args:
 *     metadata: The post's Docusaurus metadata.
 *     frontMatter: The post's front matter.
 *
 * Returns:
 *     { key, label } for each tag: key is the front matter string, or null
 *     for a tag written as an object; label is what the site shows.
 */
export function postTags(metadata, frontMatter) {
  const written = (frontMatter && Array.isArray(frontMatter.tags) && frontMatter.tags) || [];
  return (metadata.tags || []).map((tag, i) => ({
    key: typeof written[i] === "string" ? written[i] : null,
    label: tag.label,
  }));
}

/**
 * Describes a post for the steps that run after the build.
 *
 * Args:
 *     metadata: The post's Docusaurus metadata.
 *     frontMatter: The post's front matter.
 *
 * Returns:
 *     A plain object: title ("" when untitled), the front matter
 *     description ("" when not set; Docusaurus's own made-up description is
 *     not used), the Markdown source path, the permalink, the date, whether
 *     the post is unlisted, and its tags.
 */
export function postDescription(metadata, frontMatter) {
  const description = frontMatter && typeof frontMatter.description === "string" ? frontMatter.description : "";
  return {
    title: hasTitle(metadata.title) ? metadata.title.trim() : "",
    description: description.trim(),
    source: metadata.source,
    permalink: metadata.permalink,
    date: metadata.date,
    unlisted: Boolean(metadata.unlisted),
    tags: postTags(metadata, frontMatter),
  };
}

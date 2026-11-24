/**
 * Wraps Docusaurus's blog post title to mark it as the post's name ("p-name").
 *
 * Only posts with a title get this class. Bridgy treats a post with a name as
 * an article (posted as its title plus a link) and a post without one as a
 * note (posted in full, shortened with a link only if it doesn't fit). That
 * matches how Micro.blog cross-posts. Bridgy docs: https://brid.gy/about
 *
 * Untitled posts must use `title: ""` in front matter. If the title line is
 * left out entirely, Docusaurus uses the file name as the title, and the post
 * would be treated as an article.
 *
 * Swizzled in "wrap" mode: https://docusaurus.io/docs/swizzling#wrapping
 */
import React from "react";
import clsx from "clsx";
import Title from "@theme-original/BlogPostItem/Header/Title";
import { useBlogPost } from "@docusaurus/plugin-content-blog/client";

/**
 * Tells whether a post has a visible title.
 *
 * Args:
 *     title: The post's title from Docusaurus metadata; may be "".
 *
 * Returns:
 *     True if the title has any non-space characters.
 */
function hasTitle(title) {
  return typeof title === "string" && title.trim() !== "";
}

/**
 * The post title, marked as p-name on a titled post's own page.
 *
 * Args:
 *     props.className: Classes Docusaurus passes to the title.
 *     props: Any other props, passed through unchanged.
 *
 * Returns:
 *     Docusaurus's original title, with the "p-name" class added only on a
 *     post's own page and only when the post has a title.
 */
export default function TitleWrapper({ className, ...props }) {
  const { metadata, isBlogPostPage } = useBlogPost();
  const isNamed = isBlogPostPage && hasTitle(metadata.title);
  return <Title className={clsx(className, isNamed && "p-name")} {...props} />;
}

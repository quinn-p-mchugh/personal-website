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

export default function TitleWrapper({ className, ...props }) {
  const { metadata, isBlogPostPage } = useBlogPost();
  const hasTitle = Boolean(metadata.title && metadata.title.trim());
  return (
    <Title
      className={clsx(className, isBlogPostPage && hasTitle && "p-name")}
      {...props}
    />
  );
}

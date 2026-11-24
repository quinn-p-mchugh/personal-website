/**
 * Wraps Docusaurus's blog post body to mark it as the post's content
 * ("e-content"), which is the text Bridgy cross-posts to Mastodon and Bluesky.
 * Microformats docs: https://microformats.org/wiki/h-entry
 * Bridgy docs: https://brid.gy/about
 *
 * Swizzled in "wrap" mode: https://docusaurus.io/docs/swizzling#wrapping
 */
import React from "react";
import clsx from "clsx";
import Content from "@theme-original/BlogPostItem/Content";
import { useBlogPost } from "@docusaurus/plugin-content-blog/client";

export default function ContentWrapper({ className, ...props }) {
  const { isBlogPostPage } = useBlogPost();
  return (
    <Content
      className={clsx(className, isBlogPostPage && "e-content")}
      {...props}
    />
  );
}

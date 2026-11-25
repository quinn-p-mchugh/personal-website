/**
 * Wraps Docusaurus's blog post body to mark it as the post's content
 * ("e-content"): the text Bridgy cross-posts to Mastodon and Bluesky.
 * Microformats docs: https://microformats.org/wiki/h-entry
 * Bridgy docs: https://brid.gy/about
 *
 * Wraps the original component: https://docusaurus.io/docs/swizzling#wrapping
 */
import React from "react";
import clsx from "clsx";
import Content from "@theme-init/BlogPostItem/Content";
import { useBlogPost } from "@docusaurus/plugin-content-blog/client";

/**
 * The post body, marked as e-content on a post's own page.
 *
 * Args:
 *     props.className: Classes Docusaurus passes to the body.
 *     props: Any other props (including children), passed through unchanged.
 *
 * Returns:
 *     Docusaurus's original body, with the "e-content" class added on a
 *     post's own page only.
 */
export default function ContentWrapper({ className, ...props }) {
  const { isBlogPostPage } = useBlogPost();
  return (
    <Content
      className={clsx(className, isBlogPostPage && "e-content")}
      {...props}
    />
  );
}

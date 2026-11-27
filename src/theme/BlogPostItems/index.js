import React from "react";
import BlogPostItems from "@theme-original/BlogPostItems";
import { useLocation } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";

/**
 * The list of posts on a blog's pages. On a blog's first page (for example
 * /ideas), this adds the blog's title and intro above the posts. Both come
 * from contentConfig.blogConfig in docusaurus.config.js, through
 * customFields.blogIntros.
 *
 * Later pages, tag pages and author pages also list posts; they don't get
 * the intro.
 *
 * Swizzling (wrapping a Docusaurus component) docs:
 * https://docusaurus.io/docs/swizzling#wrapping
 */
function BlogIntro() {
  const { pathname } = useLocation();
  const { siteConfig } = useDocusaurusContext();
  const blog = siteConfig.customFields?.blogIntros?.[pathname.replace(/\/$/, "")];

  if (!blog) return null;
  return (
    <header className="margin-bottom--xl">
      <h1>{blog.title}</h1>
      {blog.description && <p>{blog.description}</p>}
    </header>
  );
}

export default function BlogPostItemsWrapper(props) {
  return (
    <>
      <BlogIntro />
      <BlogPostItems {...props} />
    </>
  );
}

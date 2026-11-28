/**
 * The header of a blog post, in lists and on the post's own page.
 *
 * Posts with a title keep Docusaurus's header. A post without a title (a
 * microblog post, say) gets no empty heading: on list pages its date is
 * the link to the post, as on Micro.blog; on its own page a heading is
 * kept for screen readers only, using the label from
 * src/utils/untitledPosts.js.
 * Docs: https://docusaurus.io/docs/swizzling#wrapping
 */
import React from "react";
import Link from "@docusaurus/Link";
import { useBlogPost } from "@docusaurus/plugin-content-blog/client";
import BlogPostItemHeader from "@theme-original/BlogPostItem/Header";
import BlogPostItemHeaderInfo from "@theme/BlogPostItem/Header/Info";
import BlogPostItemHeaderAuthors from "@theme/BlogPostItem/Header/Authors";
import styles from "./styles.module.css";

/**
 * Renders the post's header.
 *
 * Args:
 *     props: Passed on to Docusaurus's header for titled posts.
 *
 * Returns:
 *     The header element.
 */
export default function BlogPostItemHeaderWrapper(props) {
  const { metadata, isBlogPostPage } = useBlogPost();
  if (metadata.title && metadata.title.trim() !== "") return <BlogPostItemHeader {...props} />;

  return (
    <header>
      {isBlogPostPage ? (
        <>
          <h1 className={styles.visuallyHidden}>{metadata.frontMatter.title_meta}</h1>
          <BlogPostItemHeaderInfo />
        </>
      ) : (
        <Link to={metadata.permalink} className={styles.dateLink}>
          <BlogPostItemHeaderInfo />
        </Link>
      )}
      <BlogPostItemHeaderAuthors />
    </header>
  );
}

/**
 * Wraps Docusaurus's blog post container (the <article> around each post) to
 * add the markup Bridgy needs to cross-post to Mastodon and Bluesky.
 *
 * How it works, in plain terms:
 * - "h-entry" tells Bridgy "this block is one post". Microformats are CSS
 *   class names with agreed meanings: https://microformats.org/wiki/h-entry
 * - Hidden links tell Bridgy which networks it may publish this post to.
 *   Bridgy refuses to publish a page that lacks them: https://brid.gy/about
 * - "p-bridgy-omit-link" set to "maybe" means: add a link back to the site
 *   only when the post had to be shortened to fit, like Micro.blog does.
 *
 * Applies to every blog on the site (blog, blog-micro, blog-ideas, and any
 * added later), because all Docusaurus blogs share this theme component. Adds
 * markup only on a post's own page, never on list pages, so each page Bridgy
 * reads contains exactly one post.
 *
 * Swizzled in "wrap" mode, so Docusaurus upgrades keep working:
 * https://docusaurus.io/docs/swizzling#wrapping
 */
import React from "react";
import clsx from "clsx";
import Container from "@theme-original/BlogPostItem/Container";
import { useBlogPost } from "@docusaurus/plugin-content-blog/client";

/**
 * Networks Bridgy may publish this site's posts to. Delete a line to stop
 * cross-posting there. Docs: https://brid.gy/about
 */
const BRIDGY_PUBLISH_TARGETS = [
  "https://brid.gy/publish/mastodon",
  "https://brid.gy/publish/bluesky",
];

/**
 * Hidden, machine-readable post details for Bridgy.
 *
 * Args:
 *     props.permalink: The post's address, relative to the site root.
 *     props.date: The post's date as an ISO 8601 string.
 *
 * Returns:
 *     A hidden <div> holding the post's address and date, the link-back rule,
 *     and one link per Bridgy publish target.
 */
function BridgyPostDetails({ permalink, date }) {
  return (
    <div hidden aria-hidden="true">
      <a className="u-url" href={permalink} />
      <time className="dt-published" dateTime={date} />
      <data className="p-bridgy-omit-link" value="maybe" />
      {BRIDGY_PUBLISH_TARGETS.map((target) => (
        <a key={target} href={target} />
      ))}
    </div>
  );
}

/**
 * The post container, marked as an h-entry on a post's own page.
 *
 * Args:
 *     props.className: Classes Docusaurus passes to the container.
 *     props.children: The post's header, content and footer.
 *     props: Any other props, passed through unchanged.
 *
 * Returns:
 *     Docusaurus's original container: unchanged on list pages; with the
 *     "h-entry" class and the hidden Bridgy details on a post's own page.
 */
export default function ContainerWrapper({ className, children, ...props }) {
  const { metadata, isBlogPostPage } = useBlogPost();

  if (!isBlogPostPage) {
    return (
      <Container className={className} {...props}>
        {children}
      </Container>
    );
  }

  return (
    <Container className={clsx(className, "h-entry")} {...props}>
      {children}
      <BridgyPostDetails permalink={metadata.permalink} date={metadata.date} />
    </Container>
  );
}

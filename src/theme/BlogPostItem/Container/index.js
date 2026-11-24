/**
 * Wraps Docusaurus's blog post container (the <article> around each post) to
 * add the markup Bridgy needs to cross-post to Mastodon and Bluesky.
 *
 * How it works, in plain terms:
 * - "h-entry" tells Bridgy "this block is one post". Microformats are just
 *   CSS class names with agreed meanings: https://microformats.org/wiki/h-entry
 * - The hidden links below tell Bridgy which networks you allow this post to
 *   be published to. Bridgy refuses to publish a page that lacks them:
 *   https://brid.gy/about
 * - "p-bridgy-omit-link" set to "maybe" means: only add a link back to the
 *   site when the post had to be shortened to fit, like Micro.blog does:
 *   https://brid.gy/about
 *
 * This only adds markup on a post's own page, not on blog list pages, so each
 * page Bridgy reads contains exactly one post.
 *
 * Swizzled in "wrap" mode, so Docusaurus upgrades keep working:
 * https://docusaurus.io/docs/swizzling#wrapping
 */
import React from "react";
import clsx from "clsx";
import Container from "@theme-original/BlogPostItem/Container";
import { useBlogPost } from "@docusaurus/plugin-content-blog/client";

// Networks Bridgy may publish this site's posts to. Remove one to stop
// cross-posting there. Docs: https://brid.gy/about
const BRIDGY_PUBLISH_TARGETS = [
  "https://brid.gy/publish/mastodon",
  "https://brid.gy/publish/bluesky",
];

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
      {/* Machine-readable post details for Bridgy. Hidden from readers. */}
      <div hidden aria-hidden="true">
        <a className="u-url" href={metadata.permalink} />
        <time className="dt-published" dateTime={metadata.date} />
        <data className="p-bridgy-omit-link" value="maybe" />
        {BRIDGY_PUBLISH_TARGETS.map((target) => (
          <a key={target} href={target} />
        ))}
      </div>
    </Container>
  );
}

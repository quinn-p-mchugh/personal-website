/**
 * Wraps Docusaurus's blog post container (the <article> around each post)
 * to add the markup Bridgy needs to cross-post it to Mastodon and Bluesky.
 *
 * In plain terms:
 * - "h-entry" tells Bridgy "this block is one post". Microformats are CSS
 *   class names with agreed meanings: https://microformats.org/wiki/h-entry
 * - Hidden links tell Bridgy which networks it may publish the post to;
 *   Bridgy refuses a page without them. Docs: https://brid.gy/about
 * - "p-bridgy-omit-link" set to "maybe" means: add a link back to the site
 *   only when the post had to be shortened to fit, like Micro.blog does.
 * - The hidden element is marked "data-crosspost-details". After the build,
 *   src/postPages.js finds it and adds the post's social text, hashtags and
 *   images inside it. Everything else it needs about the post comes from
 *   the blog plugin's own data, not from the page.
 *
 * Adds markup only on a post's own page, never on list pages, so each page
 * Bridgy reads holds exactly one post. Applies to every blog on the site.
 *
 * Wraps the original component (through @theme-init, as Docusaurus
 * recommends for plugins), so Docusaurus upgrades keep working.
 * Docs: https://docusaurus.io/docs/advanced/client#theme-aliases
 */
import React from "react";
import clsx from "clsx";
import Container from "@theme-init/BlogPostItem/Container";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { useBlogPost } from "@docusaurus/plugin-content-blog/client";
import useCrosspostSettings from "../../../client/useCrosspostSettings.js";
import { BRIDGY_PUBLISH_TARGETS } from "../../../shared/names.js";
import { postAddress } from "../../../shared/posts.js";

/**
 * Hidden, machine-readable post details for Bridgy and the build steps.
 *
 * Args:
 *     props.address: The post's full public address.
 *     props.date: The post's date, as an ISO 8601 string.
 *     props.networks: Networks Bridgy may publish to, from the settings.
 *
 * Returns:
 *     A hidden <div> holding the post's address and date, the link-back
 *     rule and one link per network.
 */
function BridgyPostDetails({ address, date, networks }) {
  return (
    <div hidden aria-hidden="true" data-crosspost-details="">
      <a className="u-url" href={address} />
      <time className="dt-published" dateTime={date} />
      <data className="p-bridgy-omit-link" value="maybe" />
      {networks.map((network) => (
        <a key={network} href={BRIDGY_PUBLISH_TARGETS[network]} />
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
 *     "h-entry" class and the hidden details on a post's own page.
 */
export default function ContainerWrapper({ className, children, ...props }) {
  const { metadata, isBlogPostPage } = useBlogPost();
  const { networks } = useCrosspostSettings();
  const { siteConfig } = useDocusaurusContext();

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
      <BridgyPostDetails address={postAddress(metadata.permalink, siteConfig)} date={metadata.date} networks={networks} />
    </Container>
  );
}

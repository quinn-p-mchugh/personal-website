/**
 * Wraps Docusaurus's blog post footer to add, on a post's own page:
 * - "Also on Mastodon · Bluesky" links to the post's cross-posted copies
 *   (always, because Bridgy needs them to match replies back to the post);
 * - the responses from those networks (likes, reposts, replies), when the
 *   plugin's showResponses setting is on and webmentionUsername is set.
 * Both live in src/components/SocialResponses.
 *
 * Wraps the original component: https://docusaurus.io/docs/swizzling#wrapping
 */
import React from "react";
import Footer from "@theme-init/BlogPostItem/Footer";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { useBlogPost } from "@docusaurus/plugin-content-blog/client";
import useCrosspostSettings from "../../../client/useCrosspostSettings.js";
import SocialResponses, { SyndicationLinks } from "../../../components/SocialResponses/index.js";
import { syndicationUrls } from "../../../components/SocialResponses/mentions.js";
import { postAddress } from "../../../shared/posts.js";

/**
 * The post footer, followed by cross-post links and responses.
 *
 * Args:
 *     props: Props Docusaurus passes to the footer, passed through unchanged.
 *
 * Returns:
 *     Docusaurus's original footer; on a post's own page, followed by the
 *     syndication links and the responses section.
 */
export default function FooterWrapper(props) {
  const { metadata, frontMatter, isBlogPostPage } = useBlogPost();
  const { siteConfig } = useDocusaurusContext();
  const settings = useCrosspostSettings();

  if (!isBlogPostPage) return <Footer {...props} />;

  const showResponses = settings.showResponses && settings.webmentionUsername !== "";
  const syndication = syndicationUrls(frontMatter && frontMatter.syndication);
  // The same address the rest of the plugin uses (trailingSlash applied).
  const pageUrl = postAddress(metadata.permalink, siteConfig);
  return (
    <>
      <Footer {...props} />
      <SyndicationLinks urls={syndication} />
      {showResponses && (
        <SocialResponses pageUrl={pageUrl} syndication={syndication} />
      )}
    </>
  );
}

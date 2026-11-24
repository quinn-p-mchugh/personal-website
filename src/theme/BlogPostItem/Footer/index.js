/**
 * Wraps Docusaurus's blog post footer to add, on a post's own page:
 * - "Also on Mastodon · Bluesky" links to the post's cross-posted copies
 *   (always, because Bridgy needs them to match replies back to the post);
 * - the responses from those networks (likes, reposts, replies), when
 *   socialPosts.showResponses in docusaurus.config.js isn't false.
 * Both live in src/components/SocialResponses.
 *
 * Swizzled in "wrap" mode: https://docusaurus.io/docs/swizzling#wrapping
 */
import React from "react";
import Footer from "@theme-original/BlogPostItem/Footer";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { useBlogPost } from "@docusaurus/plugin-content-blog/client";
import SocialResponses, { SyndicationLinks } from "@site/src/components/SocialResponses";
import { syndicationUrls } from "@site/src/components/SocialResponses/mentions.mjs";
import { socialPostSettings } from "@site/src/utils/socialPosts.mjs";

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

  if (!isBlogPostPage) return <Footer {...props} />;

  const socialPosts = socialPostSettings(siteConfig);
  const syndication = syndicationUrls(frontMatter && frontMatter.syndication);
  const pageUrl = new URL(metadata.permalink, siteConfig.url).href;
  return (
    <>
      <Footer {...props} />
      <SyndicationLinks urls={syndication} />
      {socialPosts.showResponses !== false && (
        <SocialResponses pageUrl={pageUrl} syndication={syndication} />
      )}
    </>
  );
}

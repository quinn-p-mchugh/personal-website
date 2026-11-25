/**
 * Wraps Docusaurus's blog post footer to add, on a post's own page:
 * - "Also on Mastodon, Bluesky" links to the post's cross-posted copies:
 *   always in the page, because Bridgy needs them to match replies back to
 *   the post, and hidden when the showSyndicationLinks setting is off;
 * - the responses from those networks (likes, reposts, replies), when the
 *   plugin's responses.enabled setting is on, webmentionUsername is set,
 *   and the post's front matter doesn't say "crosspost_responses: false".
 * Both are theme components (src/theme/CrosspostSyndicationLinks and
 * src/theme/CrosspostResponses), so a site can restyle or swizzle them.
 *
 * Wraps the original component: https://docusaurus.io/docs/swizzling#wrapping
 */
import React from "react";
import Footer from "@theme-init/BlogPostItem/Footer";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { useBlogPost } from "@docusaurus/plugin-content-blog/client";
import useCrosspostSettings from "../../../client/useCrosspostSettings.js";
import CrosspostResponses from "@theme/CrosspostResponses";
import CrosspostSyndicationLinks from "@theme/CrosspostSyndicationLinks";
import { syndicationUrls } from "../../../shared/responses.js";
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

  const showResponses =
    settings.responses.enabled && settings.webmentionUsername !== "" && !(frontMatter && frontMatter.crosspost_responses === false);
  const syndication = syndicationUrls(frontMatter && frontMatter.syndication);
  // The same address the rest of the plugin uses (trailingSlash applied).
  const pageUrl = postAddress(metadata.permalink, siteConfig);
  return (
    <>
      <Footer {...props} />
      <CrosspostSyndicationLinks urls={syndication} visible={settings.showSyndicationLinks !== false} />
      {showResponses && <CrosspostResponses pageUrl={pageUrl} syndication={syndication} settings={settings.responses} />}
    </>
  );
}

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
 * - Titled posts with tags get their own social text, "Title: link", the
 *   front matter description if any, and a line of hashtags. Without it,
 *   Bridgy would post only "Title: link" and the tags would be lost.
 *   Untitled posts get their hashtags from plugins/remark-social-hashtags.mjs.
 *
 * Applies to every blog on the site, including any added later, because all
 * Docusaurus blogs share this theme component. Adds
 * markup only on a post's own page, never on list pages, so each page Bridgy
 * reads contains exactly one post.
 *
 * Swizzled in "wrap" mode, so Docusaurus upgrades keep working:
 * https://docusaurus.io/docs/swizzling#wrapping
 */
import React from "react";
import clsx from "clsx";
import Container from "@theme-original/BlogPostItem/Container";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { useBlogPost } from "@docusaurus/plugin-content-blog/client";
import { hashtagNamesFromTags } from "@site/src/utils/hashtags.mjs";
import { hasTitle, socialPostSettings } from "@site/src/utils/socialPosts.mjs";

/**
 * Networks Bridgy may publish this site's posts to. Delete a line to stop
 * cross-posting there. Docs: https://brid.gy/about
 */
const BRIDGY_PUBLISH_TARGETS = [
  "https://brid.gy/publish/mastodon",
  "https://brid.gy/publish/bluesky",
];

/**
 * Bridgy's per-network text overrides. Content in elements with these classes
 * replaces the post's own text on that network.
 * Docs: https://brid.gy/about
 */
const BRIDGY_CONTENT_CLASSES = ["e-bridgy-mastodon-content", "e-bridgy-bluesky-content"];

/**
 * Pairs each of a post's tags with the way it was written in front matter.
 *
 * Docusaurus builds metadata.tags from front matter tags one for one, in the
 * same order (normalizeTags in @docusaurus/utils), so the same position
 * gives the same tag. The key is what lets excludedTags match a tags file key.
 *
 * Args:
 *     metadata: The post's Docusaurus metadata.
 *     frontMatter: The post's front matter.
 *
 * Returns:
 *     { key, label } for each tag: key is the front matter string, or
 *     undefined for a tag written as an object; label is what the site shows.
 */
function postTags(metadata, frontMatter) {
  const written = (frontMatter && Array.isArray(frontMatter.tags) && frontMatter.tags) || [];
  return (metadata.tags || []).map((tag, i) => ({
    key: typeof written[i] === "string" ? written[i] : undefined,
    label: tag.label,
  }));
}

/**
 * Works out the hashtags for a titled post's social text.
 *
 * Args:
 *     metadata: The post's Docusaurus metadata.
 *     frontMatter: The post's front matter.
 *     socialPosts: The socialPosts settings from docusaurus.config.js.
 *
 * Returns:
 *     Hashtag names without "#", e.g. ["Climate", "AIEthics"]. Empty for
 *     untitled posts, posts without tags (after excludedTags), or when
 *     includeFrontMatterTags is off.
 */
function titledPostHashtags(metadata, frontMatter, socialPosts) {
  if (socialPosts.includeFrontMatterTags === false || !hasTitle(metadata.title)) return [];
  return hashtagNamesFromTags(postTags(metadata, frontMatter), socialPosts.excludedTags);
}

/**
 * The social text for a titled post: "Title: link", description, hashtags.
 *
 * Matches how Micro.blog cross-posts titled posts, with the tags added.
 *
 * Args:
 *     props.title: The post's title.
 *     props.url: The post's full address.
 *     props.description: The front matter description, possibly undefined.
 *     props.hashtags: Hashtag names without "#"; at least one.
 *
 * Returns:
 *     A <div> Bridgy uses as the post's text on every network.
 */
function TitledPostSocialText({ title, url, description, hashtags }) {
  return (
    <div className={clsx(BRIDGY_CONTENT_CLASSES)}>
      <p>
        {title}: <a href={url}>{url}</a>
      </p>
      {hasTitle(description) && <p>{description}</p>}
      <p>{hashtags.map((name) => `#${name}`).join(" ")}</p>
    </div>
  );
}

/**
 * Hidden, machine-readable post details for Bridgy.
 *
 * Args:
 *     props.metadata: The post's Docusaurus metadata.
 *     props.frontMatter: The post's front matter.
 *     props.siteUrl: The site's address, e.g. "https://quinnmchugh.net".
 *     props.socialPosts: The socialPosts settings.
 *
 * Returns:
 *     A hidden <div> holding the post's address and date, the link-back rule,
 *     one link per Bridgy publish target, and, for a titled post with tags,
 *     its social text.
 */
function BridgyPostDetails({ metadata, frontMatter, siteUrl, socialPosts }) {
  const hashtags = titledPostHashtags(metadata, frontMatter, socialPosts);
  const url = new URL(metadata.permalink, siteUrl).href;
  return (
    <div hidden aria-hidden="true">
      <a className="u-url" href={metadata.permalink} />
      <time className="dt-published" dateTime={metadata.date} />
      <data className="p-bridgy-omit-link" value="maybe" />
      {BRIDGY_PUBLISH_TARGETS.map((target) => (
        <a key={target} href={target} />
      ))}
      {hashtags.length > 0 && (
        <TitledPostSocialText
          title={metadata.title}
          url={url}
          description={frontMatter && frontMatter.description}
          hashtags={hashtags}
        />
      )}
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
  const { metadata, frontMatter, isBlogPostPage } = useBlogPost();
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
      <BridgyPostDetails
        metadata={metadata}
        frontMatter={frontMatter}
        siteUrl={siteConfig.url}
        socialPosts={socialPostSettings(siteConfig)}
      />
    </Container>
  );
}

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
 *   Untitled posts get their hashtags from src/remarkHashtags.js.
 * - Images for the social posts are added after the build, by
 *   src/images.js, inside this same element.
 *
 * Applies to every blog on the site, including any added later, because all
 * Docusaurus blogs share this theme component. Adds markup only on a post's
 * own page, never on list pages, so each page Bridgy reads contains exactly
 * one post.
 *
 * Wraps the original component rather than replacing it, so Docusaurus
 * upgrades keep working: https://docusaurus.io/docs/swizzling#wrapping
 */
import React from "react";
import clsx from "clsx";
import Container from "@theme-init/BlogPostItem/Container";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { useBlogPost } from "@docusaurus/plugin-content-blog/client";
import useCrosspostSettings from "../../../client/useCrosspostSettings.js";
import { hashtagNamesFromTags } from "../../../shared/hashtags.js";
import { BRIDGY_PUBLISH_TARGETS } from "../../../shared/names.js";
import { hasTitle } from "../../../shared/posts.js";

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
 * gives the same tag. The key is what lets tagsToHashtags.except match a tags
 * file key.
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
 *     tagsToHashtags: The plugin's tagsToHashtags setting.
 *
 * Returns:
 *     Hashtag names without "#", e.g. ["Climate", "AIEthics"]. Empty for
 *     untitled posts, posts without tags (after "except"), or when
 *     tagsToHashtags is turned off.
 */
function titledPostHashtags(metadata, frontMatter, tagsToHashtags) {
  if (!tagsToHashtags.enabled || !hasTitle(metadata.title)) return [];
  return hashtagNamesFromTags(postTags(metadata, frontMatter), tagsToHashtags.except);
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
 *     props.settings: The plugin's settings, from useCrosspostSettings.
 *
 * Returns:
 *     A hidden <div> holding the post's address and date, the link-back rule,
 *     one link per network Bridgy may publish to, and, for a titled post with
 *     tags, its social text. Marked "data-crosspost-details" so the image
 *     step after the build can find it.
 */
function BridgyPostDetails({ metadata, frontMatter, siteUrl, settings }) {
  const hashtags = titledPostHashtags(metadata, frontMatter, settings.tagsToHashtags);
  const url = new URL(metadata.permalink, siteUrl).href;
  return (
    <div hidden aria-hidden="true" data-crosspost-details="">
      <a className="u-url" href={metadata.permalink} />
      <time className="dt-published" dateTime={metadata.date} />
      <data className="p-bridgy-omit-link" value="maybe" />
      {settings.networks.map((network) => (
        <a key={network} href={BRIDGY_PUBLISH_TARGETS[network]} />
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
  const settings = useCrosspostSettings();

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
        settings={settings}
      />
    </Container>
  );
}

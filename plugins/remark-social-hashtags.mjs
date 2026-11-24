/**
 * Prepares each blog post's hashtags for cross-posting to Mastodon and Bluesky.
 *
 * Bridgy builds social posts from the text of a post's page, so this plugin
 * changes the page at build time, in two ways:
 *
 * 1. Front matter tags become hashtags on untitled posts (optional, on by
 *    default). A post with `tags: [Climate, Animal Welfare]` gets
 *    "#Climate #AnimalWelfare" added to its last line of hashtags, or to a
 *    new last line if it has none. Hashtags already in the post aren't
 *    repeated, ignoring letter case. The added hashtags are hidden on the
 *    website, which already shows the tags, but Bridgy still includes them
 *    in the social post. Titled posts are posted as "Title: link" rather than
 *    their text, so their hashtags are added by
 *    src/theme/BlogPostItem/Container instead.
 * 2. Every hashtag in the post is listed as a hidden "p-category". Mastodon
 *    makes any "#Tag" in the text clickable by itself; Bluesky only does so
 *    for hashtags Bridgy finds listed this way.
 *    Microformats docs: https://microformats.org/wiki/h-entry#p-category
 *
 * Only files in blog folders (folders whose names start with "blog") are
 * changed. Docs pages and other pages are left alone.
 *
 * Usage in docusaurus.config.js, inside remarkPlugins:
 *     [remarkSocialHashtags, socialPosts]
 * where socialPosts is { includeFrontMatterTags: true }.
 * Remark plugin docs: https://docusaurus.io/docs/markdown-features/plugins
 */
import path from "node:path";
import { newHashtagNames, toHashtagName } from "../src/utils/hashtags.mjs";

/** Matches a hashtag: "#" then letters, digits or "_", not inside a word or URL. */
const HASHTAG = /(^|[^\p{L}\p{N}_&/#])#([\p{L}\p{N}_]+)/gu;

/** Matches text made only of hashtags and spaces, like "#Quote #Resource". */
const HASHTAG_LINE = /^\s*(#[\p{L}\p{N}_]+\s*)+$/u;

/**
 * Node types whose text is never scanned for hashtags. "yaml" and "toml" are
 * the front matter block, where commented-out lines like "#description:"
 * would otherwise look like hashtags.
 */
const SKIPPED_NODE_TYPES = new Set([
  "yaml",
  "toml",
  "code",
  "inlineCode",
  "link",
  "linkReference",
  "html",
  "mdxFlowExpression",
  "mdxTextExpression",
  "mdxjsEsm",
]);

/**
 * Collects the plain text of a Markdown node, skipping code and links.
 *
 * Args:
 *     node: An mdast node.
 *
 * Returns:
 *     The node's visible text, with code, links and expressions left out.
 */
function textOf(node) {
  if (!node || SKIPPED_NODE_TYPES.has(node.type)) return "";
  if (typeof node.value === "string") return node.value;
  return (node.children || []).map(textOf).join(" ");
}

/**
 * Finds the hashtags in some text.
 *
 * Args:
 *     text: Plain text.
 *
 * Returns:
 *     Hashtag names without "#", in order of appearance, e.g. ["Quote"].
 *     All-digit names like "1" are left out, as Mastodon does.
 */
function hashtagsIn(text) {
  return [...String(text).matchAll(HASHTAG)]
    .map((match) => match[2])
    .filter((name) => !/^\d+$/.test(name)); // "#1" is a number, not a hashtag
}

/**
 * Reads a post's tag labels from its front matter.
 *
 * Docusaurus accepts tags as plain strings or as objects with a "label".
 * Docs: https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog#markdown-front-matter
 *
 * Args:
 *     frontMatter: The post's parsed front matter, possibly undefined.
 *
 * Returns:
 *     The tag labels as strings; empty if the post has no tags.
 */
function frontMatterTagLabels(frontMatter) {
  const tags = (frontMatter && frontMatter.tags) || [];
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => (typeof tag === "string" ? tag : tag && tag.label))
    .filter((label) => typeof label === "string" && label.trim() !== "");
}

/**
 * Tells whether a post is untitled, which Bridgy posts as its full text.
 *
 * Docusaurus uses the file name as the title when the title line is missing,
 * so only an explicit empty title (`title: ""`) means untitled.
 *
 * Args:
 *     frontMatter: The post's parsed front matter, possibly undefined.
 *
 * Returns:
 *     True if the front matter title is an empty or blank string.
 */
function isUntitled(frontMatter) {
  const title = frontMatter && frontMatter.title;
  return typeof title === "string" && title.trim() === "";
}

/**
 * Tells whether a node is a paragraph made only of hashtags.
 *
 * Args:
 *     node: An mdast node, possibly undefined.
 *
 * Returns:
 *     True for a paragraph like "#Quote #ReadwiseReview".
 */
function isHashtagParagraph(node) {
  return Boolean(node) && node.type === "paragraph" && HASHTAG_LINE.test(textOf(node));
}

/**
 * Builds hidden text that renders as an HTML element of the given kind.
 *
 * Uses mdast's data.hName and data.hProperties, which every Markdown-to-HTML
 * step honours, so it works whether the file is read as MDX or Markdown.
 * Docs: https://github.com/syntax-tree/mdast-util-to-hast#fields-on-nodes
 *
 * Args:
 *     tagName: HTML element to render, e.g. "span" or "p".
 *     text: The text inside it.
 *
 * Returns:
 *     An mdast node rendering as <tagName hidden class="social-hashtags">.
 */
function hiddenText(tagName, text) {
  return {
    type: tagName === "span" ? "emphasis" : "paragraph",
    data: { hName: tagName, hProperties: { hidden: true, className: ["social-hashtags"] } },
    children: [{ type: "text", value: text }],
  };
}

/**
 * Builds a hidden list of a post's hashtags as microformats categories.
 *
 * Args:
 *     names: Hashtag names without "#".
 *
 * Returns:
 *     An mdast node rendering as a hidden <div> of
 *     <data class="p-category" value="Name"> elements, which have no text.
 */
function hiddenCategories(names) {
  return {
    type: "paragraph",
    data: {
      hName: "div",
      hProperties: { hidden: true, className: ["social-hashtag-categories"] },
      hChildren: names.map((name) => ({
        type: "element",
        tagName: "data",
        properties: { className: ["p-category"], value: name },
        children: [],
      })),
    },
    children: [],
  };
}

/**
 * Finds the last part of a post that readers can see.
 *
 * Builds can leave empty nodes at the end of a post (they render as
 * "<!-- -->"), so the last node isn't always the last line of text.
 *
 * Args:
 *     tree: The post's mdast root.
 *
 * Returns:
 *     The last top-level node with visible text, or undefined if none.
 */
function lastVisibleNode(tree) {
  for (let i = tree.children.length - 1; i >= 0; i -= 1) {
    if (textOf(tree.children[i]).trim() !== "") return tree.children[i];
  }
  return undefined;
}

/**
 * Adds hashtags to a post's last line of hashtags, or as a new last line.
 *
 * Args:
 *     tree: The post's mdast root. Changed in place.
 *     names: Hashtag names without "#" to add; none may already be in the post.
 */
function appendHashtags(tree, names) {
  const text = names.map((name) => `#${name}`).join(" ");
  const last = lastVisibleNode(tree);
  if (isHashtagParagraph(last)) {
    last.children.push(hiddenText("span", ` ${text}`));
  } else {
    tree.children.push(hiddenText("p", text));
  }
}

/**
 * Tells whether a file is a post in one of the site's blog folders.
 *
 * Args:
 *     filePath: The file's absolute path, possibly undefined.
 *     siteDir: The website's root folder.
 *
 * Returns:
 *     True if the file's top folder, relative to the site, starts with "blog".
 */
function isBlogPost(filePath, siteDir) {
  if (!filePath) return false;
  const topFolder = path.relative(siteDir, filePath).split(path.sep)[0];
  return topFolder.startsWith("blog");
}

/**
 * Remark plugin entry point.
 *
 * Args:
 *     options.includeFrontMatterTags: true (the default) to add front matter
 *         tags as hashtags; false to only list the post's own hashtags for
 *         Bluesky. Set once, in socialPosts in docusaurus.config.js.
 *     options.siteDir: The website's root folder. Defaults to the folder the
 *         build runs in, which for Docusaurus is the site folder.
 *
 * Returns:
 *     A transformer that updates each blog post's Markdown tree.
 */
export default function remarkSocialHashtags(options = {}) {
  const { includeFrontMatterTags = true, siteDir = process.cwd() } = options;

  return (tree, file) => {
    if (!isBlogPost(file.path, siteDir)) return;

    const frontMatter = file.data && file.data.frontMatter;
    const inPost = newHashtagNames(hashtagsIn(textOf(tree)));
    const fromTags = includeFrontMatterTags
      ? newHashtagNames(frontMatterTagLabels(frontMatter).map(toHashtagName), inPost)
      : [];

    if (fromTags.length && isUntitled(frontMatter)) appendHashtags(tree, fromTags);
    const all = [...inPost, ...fromTags];
    if (all.length) tree.children.push(hiddenCategories(all));
  };
}

/**
 * Remark plugin: prepares each blog post's hashtags for cross-posting to
 * Mastodon and Bluesky.
 *
 * Bridgy builds social posts from the text of a post's page, so this plugin
 * changes the page while the site builds, in two ways:
 *
 * 1. Front matter tags become hashtags on untitled posts (the
 *    tagsToHashtags setting, on by default). A post with
 *    `tags: [Climate, Animal Welfare]` gets "#Climate #AnimalWelfare" added
 *    to its last line of hashtags, or to a new last line if it has none.
 *    Hashtags already in the post aren't repeated, ignoring letter case, and
 *    tags in tagsToHashtags.except are left out. The added hashtags are
 *    hidden on the website, which already shows the tags, but Bridgy still
 *    includes them in the social post. Titled posts are posted as
 *    "Title: link" rather than their text, so their hashtags are added by
 *    src/theme/BlogPostItem/Container instead.
 * 2. Every hashtag in the post is listed as a hidden "p-category". Mastodon
 *    makes any "#Tag" in the text clickable by itself; Bluesky only does so
 *    for hashtags Bridgy finds listed this way.
 *    Microformats docs: https://microformats.org/wiki/h-entry#p-category
 *
 * Only files inside a blog's content folder are changed. You don't add this
 * plugin yourself: withCrosspost (src/withCrosspost.js) adds it to every
 * blog in your config, with that blog's "path" and "tags" settings.
 * Remark plugin docs: https://docusaurus.io/docs/markdown-features/plugins
 * Tests: test/remarkHashtags.test.js
 */
import { blogOf, frontMatterTags, readTagLabels } from "./blogs.js";
import { HASHTAG_CHARACTER, hashtagNamesFromTags, hashtagsIn, newHashtagNames } from "./shared/hashtags.js";

/** Matches text made only of hashtags and spaces, like "#Quote #Resource". */
const HASHTAG_LINE = new RegExp(`^\\s*(#${HASHTAG_CHARACTER}+\\s*)+$`, "u");

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
 * Works out the hashtags for a post's front matter tags.
 *
 * Args:
 *     blog: { folder, options } from blogOf.
 *     frontMatter: The post's parsed front matter, possibly undefined.
 *     except: The tagsToHashtags.except setting.
 *
 * Returns:
 *     A promise of hashtag names without "#", excepted tags and repeats
 *     left out.
 */
async function tagHashtags(blog, frontMatter, except) {
  const tagLabels = await readTagLabels(blog);
  return hashtagNamesFromTags(frontMatterTags(frontMatter, tagLabels), except);
}

/**
 * Remark plugin entry point.
 *
 * Args:
 *     options.blogs: { path, tags } for each blog to work on, from
 *         blogSummary. Files outside these folders are left alone.
 *     options.tagsToHashtags: { enabled, except }: whether front matter tags
 *         become hashtags, and which tags never do. See src/options.js.
 *     options.siteDir: The website's root folder. Defaults to the folder the
 *         build runs in, which for Docusaurus is the site folder.
 *
 * Returns:
 *     A transformer that updates each blog post's Markdown tree.
 */
export default function remarkHashtags(options = {}) {
  const { blogs = [], tagsToHashtags = { enabled: true, except: [] }, siteDir = process.cwd() } = options;
  return async (tree, file) => {
    const blog = blogOf(file.path, blogs, siteDir);
    if (!blog) return;

    const frontMatter = file.data && file.data.frontMatter;
    const inPost = newHashtagNames(hashtagsIn(textOf(tree)));
    const fromTags = tagsToHashtags.enabled
      ? newHashtagNames(await tagHashtags(blog, frontMatter, tagsToHashtags.except), inPost)
      : [];

    if (fromTags.length && isUntitled(frontMatter)) appendHashtags(tree, fromTags);
    const all = [...inPost, ...fromTags];
    if (all.length) tree.children.push(hiddenCategories(all));
  };
}

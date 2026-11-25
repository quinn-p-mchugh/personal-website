/**
 * Build-time helpers about the site's blogs: which folder a post belongs
 * to, and which tags its blog defines. Shared by src/remarkHashtags.js and
 * src/hashtagsToTags.js. Runs in Node only.
 * Tests: test/remarkHashtags.test.js and test/hashtagsToTags.test.js
 */
import path from "node:path";
import { createRequire } from "node:module";
import { PLUGIN_NAME } from "./shared/names.js";

/** Docusaurus's blog content folder when the blog's "path" option isn't set. */
const DEFAULT_BLOG_PATH = "blog";

/** Names of the plugins and presets whose options describe a blog. */
const CLASSIC_PRESETS = new Set(["classic", "@docusaurus/preset-classic"]);
const BLOG_PLUGIN = "@docusaurus/plugin-content-blog";

/**
 * Finds every blog in a Docusaurus config.
 *
 * Looks at the classic preset's "blog" and at each
 * "@docusaurus/plugin-content-blog" entry, so a site can add or rename blogs
 * without telling this plugin.
 *
 * Args:
 *     siteConfig: The Docusaurus config object.
 *
 * Returns:
 *     The options object of each blog, as written in the config (the same
 *     objects, so callers can change them).
 */
export function blogOptionObjects(siteConfig) {
  const blogs = [];
  for (const entry of siteConfig.presets || []) {
    const [name, presetOptions] = Array.isArray(entry) ? entry : [entry, undefined];
    if (CLASSIC_PRESETS.has(name) && presetOptions && presetOptions.blog) blogs.push(presetOptions.blog);
  }
  for (const entry of siteConfig.plugins || []) {
    const [name, pluginOptions] = Array.isArray(entry) ? entry : [entry, undefined];
    if (name === BLOG_PLUGIN && pluginOptions) blogs.push(pluginOptions);
  }
  return blogs;
}

/**
 * Copies the two settings this plugin needs from a blog's options.
 *
 * Only "path" and "tags" are copied: the full options hold remarkPlugins,
 * which will hold this copy, and Docusaurus can't save a config that loops.
 * A setting that isn't written is left out, so Docusaurus's default applies.
 *
 * Args:
 *     options: One blog's options object.
 *
 * Returns:
 *     { path, tags }, each only if set.
 */
export function blogSummary(options) {
  const summary = {};
  if ("path" in options) summary.path = options.path;
  if ("tags" in options) summary.tags = options.tags;
  return summary;
}

/**
 * Tells whether a file is inside a folder (at any depth).
 *
 * Args:
 *     folder: Absolute path of a folder.
 *     filePath: Absolute path of a file.
 *
 * Returns:
 *     True if the file is somewhere under the folder. A sibling folder
 *     whose name merely starts the same way ("blog" and "blog-micro") or
 *     whose name starts with ".." doesn't count.
 */
export function isInside(folder, filePath) {
  const relative = path.relative(folder, filePath);
  return relative !== "" && !path.isAbsolute(relative) && relative.split(path.sep)[0] !== "..";
}

/**
 * Finds the blog a file belongs to.
 *
 * If blog folders are nested, the innermost one wins, as each Docusaurus
 * blog only reads its own folder.
 *
 * Args:
 *     filePath: The file's absolute path, possibly undefined.
 *     blogs: { path, tags } summaries from blogSummary.
 *     siteDir: The website's root folder.
 *
 * Returns:
 *     { folder, options }: the blog's absolute content folder and its
 *     summary, or null when the file isn't in any blog.
 */
export function blogOf(filePath, blogs, siteDir) {
  if (!filePath) return null;
  return (
    blogs
      .map((options) => ({ folder: path.resolve(siteDir, options.path ?? DEFAULT_BLOG_PATH), options }))
      .filter((blog) => isInside(blog.folder, filePath))
      .sort((a, b) => b.folder.length - a.folder.length)[0] || null
  );
}

/**
 * Reads a blog's predefined tags, so a tag key can be shown by its label.
 *
 * Docusaurus lets posts refer to tags defined in a YAML file by key, e.g.
 * "pkm" for a tag labelled "Personal Knowledge Management".
 *
 * The file is found and read by Docusaurus's own getTagsFile (from
 * @docusaurus/utils-validation), the same function the blog plugin uses. So
 * the blog's "tags" option means exactly what it means to Docusaurus: a path
 * relative to the blog folder, "tags.yml" when unset, none when false or
 * null; and a tag without a "label" gets the same default label. Any problem
 * gives an empty map, so keys are used as written; Docusaurus itself reports
 * a broken tags file when it builds the blog. Read fresh each time, not
 * cached, so an edited tags file is picked up while "docusaurus start" runs.
 * Docs: https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog#tags-file
 *
 * Args:
 *     blog: { folder, options } from blogOf.
 *
 * Returns:
 *     A promise of a Map of tag keys to labels.
 */
export async function readTagLabels(blog) {
  try {
    const { getTagsFile } = createRequire(import.meta.url)("@docusaurus/utils-validation");
    const contentPaths = { contentPath: blog.folder, contentPathLocalized: blog.folder };
    const definitions = (await getTagsFile({ tags: blog.options.tags, contentPaths })) || {};
    return new Map(Object.entries(definitions).map(([key, tag]) => [key, tag.label]));
  } catch (error) {
    console.warn(`[${PLUGIN_NAME}] Could not read the tags file for ${blog.folder}: ${error.message}`);
    return new Map();
  }
}

/**
 * Reads a post's tags from its front matter.
 *
 * Docusaurus accepts tags as plain strings or as objects with a "label". A
 * string that is a key in the tags file shows as that tag's label.
 * Docs: https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog#markdown-front-matter
 *
 * Args:
 *     frontMatter: The post's parsed front matter, possibly undefined.
 *     tagLabels: Map of tag keys to labels from readTagLabels.
 *
 * Returns:
 *     { key, label } for each tag with a label: key is the string written in
 *     front matter (undefined for a tag written as an object); label is what
 *     the site shows. Empty if the post has no tags.
 */
export function frontMatterTags(frontMatter, tagLabels) {
  const tags = (frontMatter && frontMatter.tags) || [];
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) =>
      typeof tag === "string" ? { key: tag, label: tagLabels.get(tag) || tag } : { key: undefined, label: tag && tag.label }
    )
    .filter((tag) => typeof tag.label === "string" && tag.label.trim() !== "");
}

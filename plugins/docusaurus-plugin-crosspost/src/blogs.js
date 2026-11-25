/**
 * Build-time helpers about the site's blogs: where they are in the config,
 * which folder a post belongs to, and which tags its blog defines. Used by
 * src/withCrosspost.js, src/hashtagsToTags.js and src/postPages.js. Runs
 * in Node only.
 * Tests: test/blogs.test.js and test/hashtagsToTags.test.js
 */
import path from "node:path";
import { createRequire } from "node:module";
import { PLUGIN_NAME } from "./shared/names.js";

/** Docusaurus's blog content folder when the blog's "path" option isn't set. */
const DEFAULT_BLOG_PATH = "blog";

/** The id of a blog plugin entry without an "id" option. */
const DEFAULT_PLUGIN_ID = "default";

/**
 * Tells whether a plugin or preset name loads a given Docusaurus package.
 *
 * Docusaurus accepts a package's full name, a shorthand (for plugins,
 * "content-blog" loads "@docusaurus/plugin-content-blog"; for presets,
 * "classic" loads "@docusaurus/preset-classic"), or a file path, such as
 * require.resolve("@docusaurus/plugin-content-blog").
 * Docs: https://docusaurus.io/docs/using-plugins#module-shorthands
 *
 * Args:
 *     name: The name written in the config.
 *     packageName: The full package name, e.g. "@docusaurus/preset-classic".
 *     shorthand: Its shorthand, e.g. "classic".
 *
 * Returns:
 *     True if the name loads that package.
 */
export function loadsPackage(name, packageName, shorthand) {
  if (typeof name !== "string") return false;
  if (name === packageName || name === shorthand) return true;
  // A path into the package's folder, with either kind of slash.
  return name.replace(/\\/g, "/").includes(`/${packageName}/`) || name.replace(/\\/g, "/").endsWith(`/${packageName}`);
}

/**
 * Splits a plugin or preset entry into its name and options.
 *
 * Args:
 *     entry: A "plugins" or "presets" entry: a name, [name, options], a
 *         function, or false/null (which Docusaurus skips).
 *
 * Returns:
 *     [name, options]: name is undefined for functions and skipped entries.
 */
function nameAndOptions(entry) {
  if (Array.isArray(entry)) return [entry[0], entry[1]];
  return [entry, undefined];
}

/**
 * Finds every blog in a Docusaurus config, as far as the config shows.
 *
 * Covers the classic preset's blog (on unless "blog: false", as in
 * @docusaurus/preset-classic) and each blog plugin entry, by full name,
 * shorthand or path. It can't see blogs added by presets from other
 * authors or by plugin functions; the build step reads Docusaurus's loaded
 * plugins instead, so it sees every blog (src/postPages.js). This list is
 * only needed by hashtagsToTags, which runs before plugins load.
 *
 * Args:
 *     siteConfig: The Docusaurus config object.
 *
 * Returns:
 *     Each blog's options object as written ({} for a blog left at its
 *     defaults).
 */
export function blogOptionObjects(siteConfig) {
  const blogs = [];
  for (const entry of siteConfig.presets || []) {
    const [name, presetOptions] = nameAndOptions(entry);
    if (!loadsPackage(name, "@docusaurus/preset-classic", "classic")) continue;
    const blog = presetOptions ? presetOptions.blog : undefined;
    if (blog !== false) blogs.push(blog || {});
  }
  for (const entry of siteConfig.plugins || []) {
    const [name, pluginOptions] = nameAndOptions(entry);
    if (loadsPackage(name, "@docusaurus/plugin-content-blog", "content-blog")) blogs.push(pluginOptions || {});
  }
  return blogs;
}

/**
 * Copies the settings hashtagsToTags needs from a blog's options.
 *
 * Only these are copied: the full options hold remarkPlugins, which may
 * hold this copy, and Docusaurus can't save a config that loops. A setting
 * that isn't written is left out, so Docusaurus's default applies.
 *
 * Args:
 *     options: One blog's options object.
 *
 * Returns:
 *     { path, tags, id, onInlineTags }, each only if set.
 */
export function blogSummary(options) {
  const summary = {};
  for (const key of ["path", "tags", "id", "onInlineTags"]) if (key in options) summary[key] = options[key];
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
 * Finds the translations folder name of a blog, inside a language's
 * folder: "docusaurus-plugin-content-blog", plus "-<id>" when the blog
 * has an id other than "default".
 * Docs: https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog#i18n
 *
 * Args:
 *     id: The blog's plugin id, possibly undefined.
 *
 * Returns:
 *     The folder name.
 */
export function localizedFolderName(id) {
  return !id || id === DEFAULT_PLUGIN_ID ? "docusaurus-plugin-content-blog" : `docusaurus-plugin-content-blog-${id}`;
}

/**
 * Finds the blog a file belongs to, including translated posts.
 *
 * If blog folders are nested, the innermost one wins, as each Docusaurus
 * blog only reads its own folder. A file in
 * "<site>/<i18nPath>/<language>/docusaurus-plugin-content-blog[-id]/" is a
 * translated post of that blog.
 *
 * Args:
 *     filePath: The file's absolute path, possibly undefined.
 *     blogs: { path, tags, id, onInlineTags } summaries from blogSummary.
 *     siteDir: The website's root folder.
 *     i18nPath: The site's i18n.path setting ("i18n" by default).
 *
 * Returns:
 *     { folder, localizedFolder, options }: the blog's absolute content
 *     folder, the translations folder the file is in (or the content folder
 *     for an untranslated post), and its summary; null when the file isn't
 *     in any blog.
 */
export function blogOf(filePath, blogs, siteDir, i18nPath = "i18n") {
  if (!filePath) return null;
  const candidates = blogs.map((options) => ({ folder: path.resolve(siteDir, options.path ?? DEFAULT_BLOG_PATH), options }));
  const own = candidates
    .filter((blog) => isInside(blog.folder, filePath))
    .sort((a, b) => b.folder.length - a.folder.length)[0];
  if (own) return { ...own, localizedFolder: own.folder };

  const i18nRoot = path.resolve(siteDir, i18nPath);
  if (!isInside(i18nRoot, filePath)) return null;
  const [language, folderName] = path.relative(i18nRoot, filePath).split(path.sep);
  const translated = candidates.find((blog) => localizedFolderName(blog.options.id) === folderName);
  return translated ? { ...translated, localizedFolder: path.join(i18nRoot, language, folderName) } : null;
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
 *     blog: { folder, localizedFolder, options }: the blog's content
 *         folder, its translations folder for the current language (the
 *         same folder when there are none), and its settings ("tags").
 *
 * Returns:
 *     A promise of a Map of tag keys to labels.
 */
export async function readTagLabels(blog) {
  try {
    const { getTagsFile } = createRequire(import.meta.url)("@docusaurus/utils-validation");
    const contentPaths = { contentPath: blog.folder, contentPathLocalized: blog.localizedFolder ?? blog.folder };
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

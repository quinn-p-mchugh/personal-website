/**
 * Turns hashtags written in a blog post into tags on the website (the
 * hashtagsToTags setting, off by default).
 *
 * A post that says "Reading about #Climate today" gets the tag "Climate",
 * so it shows up on the site's tag pages, as if `tags: [Climate]` were in
 * its front matter. It works while the site builds, through Docusaurus's
 * markdown.parseFrontMatter hook, so the post's file is never changed:
 * edit the hashtag and the tag follows.
 * Docs: https://docusaurus.io/docs/api/docusaurus-config#markdown
 *
 * Rules:
 * - A hashtag that matches a tag in the blog's tags file (by key or label,
 *   ignoring case, spaces and punctuation) adds that tag, so "#PKM" adds
 *   your "pkm" tag. Any other hashtag adds a new tag named as written.
 * - Hashtags in hashtagsToTags.excludedHashtags never become tags.
 * - Hashtags in code, links, HTML and MDX code are ignored.
 * - Tags already in the front matter aren't repeated.
 * - On a blog with onInlineTags: "throw" and a tags file, only hashtags
 *   that match a tag in that file are added, since any other tag would stop
 *   the build. Docs: https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog#onInlineTags
 * - Translated posts (in i18n/<locale>/docusaurus-plugin-content-blog...)
 *   count as part of their blog.
 *
 * You don't add this yourself: withCrosspost (src/withCrosspost.js) sets it
 * up, and keeps any parseFrontMatter function the site already had.
 * Tests: test/hashtagsToTags.test.js
 */
import fs from "node:fs";
import path from "node:path";
import { blogOf, frontMatterTags, readTagLabels } from "./blogs.js";
import { comparisonForm, hashtagsIn, nameSet } from "./shared/hashtags.js";

/**
 * Parts of Markdown whose text isn't the post's own words, removed before
 * looking for hashtags. Order matters: code first, so "#" inside code is
 * never seen.
 */
const NOT_PROSE = [
  /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, // fenced code blocks
  /`[^`\n]+`/g, // inline code
  /<!--[\s\S]*?-->/g, // HTML comments
  /\]\([^)\n]*\)/g, // link and image addresses: [text](address)
  /^[ \t]*\[[^\]\n]+\]:[ \t]*\S+.*$/gm, // reference link definitions: [name]: address
  /<[^>\n]+>/g, // HTML and JSX tags, and <https://...> autolinks
  /\{[^{}\n]*\}/g, // MDX expressions like {props.value}
];

/**
 * Finds the hashtags a post's author wrote, ignoring code and links.
 *
 * Args:
 *     markdown: The post's Markdown, without its front matter.
 *
 * Returns:
 *     Hashtag names without "#", in order of appearance.
 */
export function proseHashtags(markdown) {
  const prose = NOT_PROSE.reduce((text, pattern) => text.replace(pattern, " "), String(markdown));
  return hashtagsIn(prose);
}

/**
 * Works out which tag each hashtag should add.
 *
 * Args:
 *     hashtags: Hashtag names without "#".
 *     tagLabels: Map of the blog's tag keys to labels, from readTagLabels.
 *
 * Returns:
 *     The tag to add for each hashtag, in the same order: the tags file key
 *     when the hashtag matches a key or label there, else the hashtag name.
 */
export function tagsForHashtags(hashtags, tagLabels) {
  const keyByForm = new Map();
  for (const [key, label] of tagLabels) {
    keyByForm.set(comparisonForm(key), key);
    keyByForm.set(comparisonForm(label), key);
  }
  return hashtags.map((name) => keyByForm.get(comparisonForm(name)) || name);
}

/**
 * Adds a post's hashtags to its front matter tags.
 *
 * Args:
 *     tags: The front matter "tags" value as written; may be undefined.
 *     hashtags: Hashtag names found in the post.
 *     tagLabels: Map of the blog's tag keys to labels.
 *     excludedHashtags: The hashtagsToTags.excludedHashtags setting.
 *     onlyKnownTags: If true, skip hashtags that match no tag in tagLabels.
 *
 * Returns:
 *     The new "tags" list, or the original value unchanged when nothing is
 *     added or when "tags" isn't a list (Docusaurus reports that itself).
 */
export function addHashtagTags(tags, hashtags, tagLabels, excludedHashtags, onlyKnownTags = false) {
  if (tags !== undefined && !Array.isArray(tags)) return tags;
  const existing = frontMatterTags({ tags: tags || [] }, tagLabels);
  const taken = new Set(existing.flatMap((tag) => [tag.key, tag.label]).filter(Boolean).map(comparisonForm));
  const excluded = nameSet(excludedHashtags);

  const added = [];
  for (const [i, tag] of tagsForHashtags(hashtags, tagLabels).entries()) {
    const forms = [comparisonForm(hashtags[i]), comparisonForm(tag)];
    if (forms.some((form) => excluded.has(form) || taken.has(form))) continue;
    if (onlyKnownTags && !tagLabels.has(tag)) continue;
    forms.forEach((form) => taken.add(form));
    added.push(tag);
  }
  return added.length ? [...(tags || []), ...added] : tags;
}

/** Names Docusaurus looks for when it finds a site's config file
 * (findConfig in @docusaurus/core). */
const CONFIG_FILE_NAMES = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"].map((extension) => `docusaurus.config${extension}`);

/**
 * Finds the site folder a file belongs to: the nearest folder above it
 * holding a Docusaurus config file. This works however the build was
 * started, e.g. "docusaurus build website" from the repository root.
 *
 * Args:
 *     filePath: A Markdown file's absolute path.
 *     cache: A Map of folders already checked to their site folder.
 *
 * Returns:
 *     The site folder, or null if no folder above holds a config file.
 */
export function siteDirOf(filePath, cache = new Map()) {
  const checked = [];
  let folder = path.dirname(filePath);
  for (;;) {
    if (cache.has(folder)) {
      const found = cache.get(folder);
      checked.forEach((dir) => cache.set(dir, found));
      return found;
    }
    checked.push(folder);
    if (CONFIG_FILE_NAMES.some((name) => fs.existsSync(path.join(folder, name)))) {
      checked.forEach((dir) => cache.set(dir, folder));
      return folder;
    }
    const parent = path.dirname(folder);
    if (parent === folder) {
      checked.forEach((dir) => cache.set(dir, null));
      return null;
    }
    folder = parent;
  }
}

/**
 * Builds the markdown.parseFrontMatter function for the site config.
 *
 * Args:
 *     args.blogs: { path, tags, id, onInlineTags } for each blog, from
 *         blogSummary.
 *     args.hashtagsToTags: { enabled, excludedHashtags }, from the settings.
 *     args.i18nPath: The site's i18n.path setting ("i18n" by default).
 *     args.siteDir: The website's root folder; found from each file's
 *         location when not given.
 *     args.previous: The site's own parseFrontMatter, if it had one; it
 *         still runs first.
 *
 * Returns:
 *     An async function Docusaurus calls for every Markdown file.
 */
export function createParseFrontMatter({ blogs, hashtagsToTags, i18nPath = "i18n", siteDir, previous }) {
  const siteDirs = new Map();
  return async function parseFrontMatter(params) {
    const result = previous ? await previous(params) : await params.defaultParseFrontMatter(params);
    if (!hashtagsToTags.enabled || !params.filePath) return result;
    const root = siteDir ?? siteDirOf(params.filePath, siteDirs) ?? process.cwd();
    const blog = blogOf(params.filePath, blogs, root, i18nPath);
    if (!blog) return result;

    const hashtags = proseHashtags(result.content);
    if (!hashtags.length) return result;
    const tagLabels = await readTagLabels(blog);
    const onlyKnownTags = blog.options.onInlineTags === "throw" && tagLabels.size > 0;
    const tags = addHashtagTags(result.frontMatter.tags, hashtags, tagLabels, hashtagsToTags.excludedHashtags, onlyKnownTags);
    if (tags === result.frontMatter.tags) return result;
    return { ...result, frontMatter: { ...result.frontMatter, tags } };
  };
}

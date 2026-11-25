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
 *
 * You don't add this yourself: withCrosspost (src/withCrosspost.js) sets it
 * up, and keeps any parseFrontMatter function the site already had.
 * Tests: test/hashtagsToTags.test.js
 */
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
 *
 * Returns:
 *     The new "tags" list, or the original value unchanged when nothing is
 *     added or when "tags" isn't a list (Docusaurus reports that itself).
 */
export function addHashtagTags(tags, hashtags, tagLabels, excludedHashtags) {
  if (tags !== undefined && !Array.isArray(tags)) return tags;
  const existing = frontMatterTags({ tags: tags || [] }, tagLabels);
  const taken = new Set(existing.flatMap((tag) => [tag.key, tag.label]).filter(Boolean).map(comparisonForm));
  const excluded = nameSet(excludedHashtags);

  const added = [];
  for (const [i, tag] of tagsForHashtags(hashtags, tagLabels).entries()) {
    const forms = [comparisonForm(hashtags[i]), comparisonForm(tag)];
    if (forms.some((form) => excluded.has(form) || taken.has(form))) continue;
    forms.forEach((form) => taken.add(form));
    added.push(tag);
  }
  return added.length ? [...(tags || []), ...added] : tags;
}

/**
 * Builds the markdown.parseFrontMatter function for the site config.
 *
 * Args:
 *     args.blogs: { path, tags } for each blog, from blogSummary.
 *     args.hashtagsToTags: { enabled, excludedHashtags }, from the settings.
 *     args.siteDir: The website's root folder.
 *     args.previous: The site's own parseFrontMatter, if it had one; it
 *         still runs first.
 *
 * Returns:
 *     An async function Docusaurus calls for every Markdown file.
 */
export function createParseFrontMatter({ blogs, hashtagsToTags, siteDir = process.cwd(), previous }) {
  return async function parseFrontMatter(params) {
    const result = previous ? await previous(params) : await params.defaultParseFrontMatter(params);
    if (!hashtagsToTags.enabled) return result;
    const blog = blogOf(params.filePath, blogs, siteDir);
    if (!blog) return result;

    const hashtags = proseHashtags(result.content);
    if (!hashtags.length) return result;
    const tags = addHashtagTags(result.frontMatter.tags, hashtags, await readTagLabels(blog), hashtagsToTags.excludedHashtags);
    if (tags === result.frontMatter.tags) return result;
    return { ...result, frontMatter: { ...result.frontMatter, tags } };
  };
}

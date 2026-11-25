/**
 * Finishes each blog post page after Docusaurus has built the site.
 *
 * The theme's Container (src/theme/BlogPostItem/Container) leaves a hidden
 * element on every post page, holding the post's details as JSON
 * (data-crosspost-post). For each such page, this step adds inside that
 * element:
 * - the post's social text for Bridgy (src/socialText.js), when it has one;
 * - the post's images, as hidden u-photo copies (src/images.js), for
 *   untitled posts and posts written with a socialPostTemplates rule. Titled
 *   posts with the built-in "Title: link" text get none, so the networks
 *   show the link's preview card, as before;
 * - every hashtag, as a hidden "p-category". Mastodon makes "#Tag" in the
 *   text clickable by itself; Bluesky only does so for hashtags Bridgy
 *   finds listed this way. Docs: https://microformats.org/wiki/h-entry
 * It also writes crosspost.json at the site's root (see manifestFor),
 * which the "send" command reads to know when a new post is live and where
 * it is (src/cli/send.js).
 *
 * Only the inserted parts change; the rest of each page is kept byte for
 * byte. Runs in Docusaurus's postBuild step, so only in production builds.
 * Docs: https://docusaurus.io/docs/api/plugin-methods/lifecycle-apis#postBuild
 * Tests: test/postPages.test.js
 */
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { DomUtils, parseDocument } from "htmlparser2";
import { blogOptionObjects } from "./blogs.js";
import { socialPhotos } from "./images.js";
import { hashtagNamesFromTags, hashtagsIn, newHashtagNames } from "./shared/hashtags.js";
import { PLUGIN_NAME } from "./shared/names.js";
import { chooseTemplate, escapeHtml, renderTemplate } from "./socialText.js";

/** File name of the list of published posts, at the site's root. */
export const MANIFEST_FILE = "crosspost.json";

/** Version of crosspost.json's layout; raised if it ever changes. */
export const MANIFEST_VERSION = 1;

/** Elements whose text is never searched for hashtags. */
const NOT_PROSE = new Set(["code", "pre", "kbd", "samp", "a", "script", "style", "svg"]);

/**
 * Lists every HTML file in the built site.
 *
 * Args:
 *     folder: The build folder, or a folder inside it.
 *
 * Returns:
 *     A promise of absolute paths of .html files.
 */
export async function htmlFiles(folder) {
  const entries = await fs.readdir(folder, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) return htmlFiles(full);
      return entry.name.endsWith(".html") ? [full] : [];
    })
  );
  return nested.flat();
}

/**
 * Tells whether an element has a class.
 *
 * Args:
 *     element: An htmlparser2 element.
 *     name: A class name.
 *
 * Returns:
 *     True if the element's class list includes the name.
 */
function hasClass(element, name) {
  return String(element.attribs.class || "").split(/\s+/).includes(name);
}

/**
 * Finds the parts of a post page this step needs.
 *
 * Args:
 *     html: A built page's HTML.
 *
 * Returns:
 *     { details, content, post } for a post's own page: the hidden details
 *     element, the post's text element (e-content), and the post's details
 *     parsed from JSON. null for any other page, or if the JSON is broken.
 */
export function findPostPage(html) {
  const document = parseDocument(html, { withStartIndices: true, withEndIndices: true });
  const entry = DomUtils.findOne((el) => hasClass(el, "h-entry"), document.children, true);
  if (!entry) return null;
  const details = DomUtils.findOne((el) => "data-crosspost-post" in el.attribs, [entry], true);
  const content = DomUtils.findOne((el) => hasClass(el, "e-content"), [entry], true);
  if (!details || !content) return null;
  try {
    return { details, content, post: JSON.parse(details.attribs["data-crosspost-post"]) };
  } catch {
    return null;
  }
}

/**
 * Gets the plain text of an element, leaving out code and links.
 *
 * Args:
 *     node: An htmlparser2 node.
 *
 * Returns:
 *     The text readers see, without code, links, scripts and images, with
 *     a space between elements so words don't run together.
 */
export function proseText(node) {
  if (node.type === "text") return node.data;
  if (NOT_PROSE.has(node.name)) return " ";
  return (node.children || []).map(proseText).join(" ");
}

/** Elements left out of a post's text on Mastodon and Bluesky: images go
 * separately (as photos), and the rest isn't text. */
const NOT_SOCIAL_TEXT = new Set(["img", "picture", "figure", "video", "audio", "iframe", "svg", "script", "style", "noscript"]);

/**
 * Gets a post's text as balanced HTML for its Mastodon and Bluesky copies.
 *
 * Built pages are minified, and the minifier leaves out optional end tags
 * such as </p>. So a slice of the page's source isn't safe to put inside
 * other markup; this re-serializes the element's children instead, without
 * images and other non-text elements, and without paragraphs left empty.
 *
 * Args:
 *     element: The post's .e-content element, parsed with htmlparser2.
 *
 * Returns:
 *     The HTML; "" if nothing is left.
 */
export function socialContentHtml(element) {
  // encodeEntities "utf8": escape only & < > " ', keeping other characters as they are.
  const copy = parseDocument(DomUtils.getInnerHTML(element, { encodeEntities: "utf8" }));
  for (const node of DomUtils.findAll((el) => NOT_SOCIAL_TEXT.has(el.name), copy.children)) DomUtils.removeElement(node);
  for (const node of DomUtils.findAll((el) => el.name === "p" && DomUtils.textContent(el).trim() === "", copy.children)) {
    DomUtils.removeElement(node);
  }
  return DomUtils.getInnerHTML(copy, { encodeEntities: "utf8" }).trim();
}

/**
 * Inserts HTML at the end of an element, changing nothing else.
 *
 * Args:
 *     html: The page's HTML.
 *     element: An htmlparser2 element parsed from it, with end indices.
 *     insert: The HTML to add as the element's last children.
 *
 * Returns:
 *     The updated HTML.
 */
export function insertAtEnd(html, element, insert) {
  const closingTag = html.lastIndexOf("</", element.endIndex);
  return html.slice(0, closingTag) + insert + html.slice(closingTag);
}

/**
 * Finds which blog a post's Markdown file belongs to.
 *
 * Args:
 *     source: The post's source, as Docusaurus gives it, e.g.
 *         "@site/blog-ideas/2026/my-post.md".
 *     blogFolders: Each blog's "path" setting, e.g. ["blog", "blog-ideas"].
 *
 * Returns:
 *     The blog's folder as written in its "path" setting, or null. If blog
 *     folders are nested, the innermost one wins.
 */
export function blogFolderOf(source, blogFolders) {
  const file = String(source || "").replace(/^@site\//, "");
  const tidy = (folder) => String(folder).replace(/^\.\//, "").replace(/\/+$/, "");
  return (
    blogFolders
      .filter((folder) => file.startsWith(`${tidy(folder)}/`))
      .sort((a, b) => tidy(b).length - tidy(a).length)[0] ?? null
  );
}

/**
 * Collects everything the social text needs to know about a post.
 *
 * Args:
 *     page: From findPostPage.
 *     pageUrl: The post's full address.
 *     blogFolders: Each blog's "path" setting.
 *     tagsToHashtags: The tagsToHashtags setting.
 *
 * Returns:
 *     { title, description, url, blogFolder, tags, contentHtml,
 *     contentText, textHashtags, tagHashtags }: textHashtags are the
 *     hashtags written in the post; tagHashtags are its tags as hashtags,
 *     without excluded tags or ones already in the text.
 */
export function describePost(page, pageUrl, blogFolders, tagsToHashtags) {
  const { post, content } = page;
  const tags = Array.isArray(post.tags) ? post.tags : [];
  const textHashtags = newHashtagNames(hashtagsIn(proseText(content)));
  const tagHashtags = tagsToHashtags.enabled
    ? newHashtagNames(hashtagNamesFromTags(tags, tagsToHashtags.excludedTags), textHashtags)
    : [];
  return {
    title: String(post.title || ""),
    description: String(post.description || ""),
    url: pageUrl,
    blogFolder: blogFolderOf(post.source, blogFolders),
    tags,
    contentHtml: socialContentHtml(content),
    contentText: proseText(content).replace(/\s+/g, " ").trim(),
    textHashtags,
    tagHashtags,
  };
}

/**
 * Builds the hidden markup added to one post page.
 *
 * Args:
 *     socialText: The post's social text as HTML; "" for none.
 *     networks: Networks Bridgy may publish to, from the settings.
 *     photos: { url, alt } for each image to attach.
 *     hashtags: Every hashtag in the post's social text, without "#".
 *
 * Returns:
 *     HTML for the social text element, the u-photo images and the
 *     p-category list.
 */
export function addedMarkup(socialText, networks, photos, hashtags) {
  const classes = networks.map((network) => `e-bridgy-${network}-content`).join(" ");
  const text = socialText ? `<div class="${classes}">${socialText}</div>` : "";
  const images = photos
    .map(({ url, alt }) => `<img class="u-photo" loading="lazy" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}">`)
    .join("");
  const categories = hashtags.map((name) => `<data class="p-category" value="${escapeHtml(name)}"></data>`).join("");
  return text + images + categories;
}

/**
 * Finishes one built page, if it's a post page.
 *
 * Args:
 *     file: The page's path in the build folder.
 *     options: The plugin's settings.
 *     context: { outDir, siteUrl, baseUrl, cacheDir, blogFolders }.
 *
 * Returns:
 *     A promise of the post's crosspost.json entry ({ source, url, date }),
 *     with the number of images attached; null for other pages and for
 *     unlisted posts (which still get their markup).
 */
export async function finishPostPage(file, options, context) {
  const html = await fs.readFile(file, "utf8");
  if (!html.includes("data-crosspost-post")) return null;
  const page = findPostPage(html);
  if (!page) return null;

  const pageUrl = new URL(page.post.permalink, context.siteUrl).href;
  const post = describePost(page, pageUrl, context.blogFolders, options.tagsToHashtags);
  const { template, fromSettings } = chooseTemplate(options.socialPostTemplates, post);
  const socialText = template ? renderTemplate(template, post) : "";
  const attachImages = options.images.enabled && (post.title === "" || (fromSettings && socialText !== ""));

  const images = DomUtils.findAll((el) => el.name === "img", [page.content]);
  const photos = attachImages ? await socialPhotos(images, pageUrl, options.images, context) : [];
  const hashtags = [...post.textHashtags, ...post.tagHashtags];

  await fs.writeFile(file, insertAtEnd(html, page.details, addedMarkup(socialText, options.networks, photos, hashtags)));
  if (page.post.unlisted) return null;
  const source = String(page.post.source || "").replace(/^@site\//, "");
  return { source, url: pageUrl, date: page.post.date, images: photos.length };
}

/**
 * Describes each blog for crosspost.json.
 *
 * Args:
 *     siteConfig: The Docusaurus config object.
 *
 * Returns:
 *     { path, exclude } for each blog: its content folder and the glob
 *     patterns of files it leaves out, both as Docusaurus uses them
 *     (with Docusaurus's defaults when not set).
 *     Docs: https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog#configuration
 */
export function blogDescriptions(siteConfig) {
  const { GlobExcludeDefault } = createRequire(import.meta.url)("@docusaurus/utils");
  return blogOptionObjects(siteConfig).map((options) => ({
    path: options.path ?? "blog",
    exclude: options.exclude ?? GlobExcludeDefault,
  }));
}

/**
 * Builds crosspost.json: what the "send" command needs to know.
 *
 * Args:
 *     options: The plugin's settings.
 *     blogs: From blogDescriptions.
 *     entries: { source, url, date } for each published post.
 *
 * Returns:
 *     { generator, version, networks, blogs, posts }, with posts sorted by
 *     source file.
 */
export function manifestFor(options, blogs, entries) {
  return {
    generator: PLUGIN_NAME,
    version: MANIFEST_VERSION,
    networks: options.networks,
    blogs,
    posts: entries
      .map(({ source, url, date }) => ({ source, url, date }))
      .sort((a, b) => a.source.localeCompare(b.source)),
  };
}

/**
 * Finishes every post page and writes crosspost.json.
 *
 * Called from the plugin's postBuild step.
 *
 * Args:
 *     options: The plugin's settings, with template files read.
 *     context: { outDir, siteUrl, baseUrl, cacheDir, siteConfig }.
 *
 * Returns:
 *     A promise of { posts, images }: how many published posts were
 *     finished, and how many images were attached to them.
 */
export async function finishPostPages(options, context) {
  const blogs = blogDescriptions(context.siteConfig);
  const blogFolders = blogs.map((blog) => blog.path);
  const entries = [];
  for (const file of await htmlFiles(context.outDir)) {
    const entry = await finishPostPage(file, options, { ...context, blogFolders });
    if (entry) entries.push(entry);
  }
  const manifest = manifestFor(options, blogs, entries);
  await fs.writeFile(path.join(context.outDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  return { posts: entries.length, images: entries.reduce((sum, entry) => sum + entry.images, 0) };
}

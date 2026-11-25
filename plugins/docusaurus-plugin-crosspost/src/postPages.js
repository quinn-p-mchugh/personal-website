/**
 * Finishes each blog post page after Docusaurus has built the site.
 *
 * Docusaurus gives every plugin's postBuild step the list of loaded plugins
 * ("plugins"), with each one's settings (defaults filled in) and content.
 * This step reads every blog from there, whatever way it was configured:
 * the classic preset (with or without a "blog" option), any number of
 * blog plugins, shorthand names or file paths, a preset from another
 * author, or a config file that exports a function. The posts, their
 * permalinks, tags and front matter come from the blog plugin's own data.
 * Docs: https://docusaurus.io/docs/api/plugin-methods/lifecycle-apis#postBuild
 *
 * Each post's page is found the way Docusaurus's own blog feed finds it
 * (readOutputHTMLFile in @docusaurus/utils), so every trailingSlash setting
 * works. On each page, the theme's Container (src/theme/BlogPostItem/
 * Container) has left a hidden element marked data-crosspost-details. This
 * step adds inside it:
 * - the post's social text for Bridgy (src/socialText.js), when it has one;
 * - the post's images, as hidden u-photo copies (src/images.js), for
 *   untitled posts and posts written with a socialPostTemplates rule. Titled
 *   posts with the built-in "Title: link" text get none, so the networks
 *   show the link's preview card;
 * - every hashtag, as a hidden "p-category". Mastodon makes "#Tag" in the
 *   text clickable by itself; Bluesky only does so for hashtags Bridgy
 *   finds listed this way. Docs: https://microformats.org/wiki/h-entry
 * It also writes crosspost.json at the root of the build (see manifestFor),
 * which the "send" command reads to know when a new post is live and where
 * it is (src/cli/send.js). With i18n, each language is built separately,
 * so each gets its own crosspost.json under its own baseUrl.
 *
 * Only the inserted parts change; the rest of each page is kept byte for
 * byte, and each page is replaced in one step (src/shared/files.js), since
 * the blog plugin reads pages for its feeds at the same time.
 * Tests: test/postPages.test.js
 */
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { DomUtils, parseDocument } from "htmlparser2";
import { readTagLabels } from "./blogs.js";
import { socialPhotos } from "./images.js";
import { writeFileSafely } from "./shared/files.js";
import { hashtagNamesFromTags, hashtagsIn, newHashtagNames } from "./shared/hashtags.js";
import { BLOG_PLUGIN_NAME, PLUGIN_NAME } from "./shared/names.js";
import { hasTitle, postAddress, tagsWithKeys } from "./shared/posts.js";
import { chooseTemplate, escapeHtml, renderTemplate } from "./socialText.js";

const require = createRequire(import.meta.url);

/** File name of the list of published posts, at the site's root. */
export const MANIFEST_FILE = "crosspost.json";

/** Version of crosspost.json's layout; raised if it ever changes. */
export const MANIFEST_VERSION = 1;

/** Docusaurus's default "include" for a blog: every Markdown and MDX file. */
export const DEFAULT_BLOG_INCLUDE = ["**/*.{md,mdx}"];

/** Elements whose text is never searched for hashtags. */
const NOT_PROSE = new Set(["code", "pre", "kbd", "samp", "a", "script", "style", "svg"]);

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
 * Finds the parts of a post page this step needs.
 *
 * Args:
 *     html: A built page's HTML.
 *
 * Returns:
 *     { details, content }: the hidden details element and the post's text
 *     element (e-content), both inside the page's h-entry; null when the
 *     page has no such markup (for example, when a component in src/theme
 *     replaces the plugin's BlogPostItem/Container).
 */
export function findPostPage(html) {
  const document = parseDocument(html, { withStartIndices: true, withEndIndices: true });
  const entry = DomUtils.findOne((el) => hasClass(el, "h-entry"), document.children, true);
  if (!entry) return null;
  const details = DomUtils.findOne((el) => "data-crosspost-details" in el.attribs, [entry], true);
  const content = DomUtils.findOne((el) => hasClass(el, "e-content"), [entry], true);
  return details && content ? { details, content } : null;
}

/**
 * Turns a path into one with forward slashes, as crosspost.json uses.
 *
 * Args:
 *     filePath: A relative path.
 *
 * Returns:
 *     The same path with "/" between folders.
 */
function posixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

/**
 * Lists the site's blogs, as Docusaurus loaded them.
 *
 * Args:
 *     plugins: The loaded plugins, from postBuild's "plugins".
 *     siteDir: The site folder.
 *     localizationDir: This language's translations folder, from postBuild
 *         (e.g. "<site>/i18n/fr"); may be undefined.
 *
 * Returns:
 *     For each blog: { id, path, folder, localizedFolder, include, exclude,
 *     tags, posts }. path is the content folder relative to the site
 *     folder, with "/"; folder and localizedFolder are absolute (where
 *     Docusaurus reads posts and their translations); include, exclude and
 *     tags are the blog's settings with Docusaurus's defaults; posts are the
 *     blog plugin's posts for this build (drafts are already left out).
 *     Docs: https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog#configuration
 */
export function loadedBlogs(plugins, siteDir, localizationDir) {
  const { GlobExcludeDefault, getPluginI18nPath } = require("@docusaurus/utils");
  return (plugins || [])
    .filter((plugin) => plugin && plugin.name === BLOG_PLUGIN_NAME)
    .map((plugin) => {
      const options = plugin.options || {};
      const id = options.id ?? "default";
      const folder = path.resolve(siteDir, options.path ?? "blog");
      const localizedFolder = localizationDir
        ? getPluginI18nPath({ localizationDir, pluginName: BLOG_PLUGIN_NAME, pluginId: id })
        : folder;
      return {
        id,
        path: posixPath(path.relative(siteDir, folder)) || ".",
        folder,
        localizedFolder,
        include: options.include ?? DEFAULT_BLOG_INCLUDE,
        exclude: options.exclude ?? GlobExcludeDefault,
        tags: options.tags,
        posts: (plugin.content && plugin.content.blogPosts) || [],
      };
    });
}

/**
 * Finds the built HTML file of a page, the way Docusaurus's blog feed does
 * (readOutputHTMLFile in @docusaurus/utils): "<path>/index.html" unless
 * trailingSlash is false, "<path>.html" unless trailingSlash is true.
 *
 * Args:
 *     permalink: The page's permalink, including the baseUrl.
 *     site: { outDir, baseUrl, trailingSlash }.
 *
 * Returns:
 *     A promise of the file's path, or null if neither file exists.
 */
export async function postPageFile(permalink, site) {
  const relative = permalink.startsWith(site.baseUrl) ? permalink.slice(site.baseUrl.length) : permalink;
  const withSlash = path.join(site.outDir, relative, "index.html");
  const base = path.join(site.outDir, relative.replace(/\/$/, ""));
  const withoutSlash = /\.html?$/i.test(base) ? base : `${base}.html`;
  const candidates = [site.trailingSlash !== false && withSlash, site.trailingSlash !== true && withoutSlash].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Not this one; try the next.
    }
  }
  return null;
}

/**
 * Collects everything the social text needs to know about a post.
 *
 * Args:
 *     metadata: The post's metadata from the blog plugin.
 *     content: The post's e-content element on its page.
 *     blog: The post's blog, from loadedBlogs.
 *     address: The post's full public address.
 *     tagLabels: Map of the blog's tags-file keys to labels.
 *     tagsToHashtags: The tagsToHashtags setting.
 *
 * Returns:
 *     { title, description, url, blogFolder, blogId, tags, contentHtml,
 *     contentText, textHashtags, tagHashtags }: textHashtags are the
 *     hashtags written in the post; tagHashtags are its tags as hashtags,
 *     without excluded tags or ones already in the text.
 */
export function describePost(metadata, content, blog, address, tagLabels, tagsToHashtags) {
  const frontMatter = metadata.frontMatter || {};
  const tags = tagsWithKeys(metadata.tags, frontMatter.tags, tagLabels);
  const textHashtags = newHashtagNames(hashtagsIn(proseText(content)));
  const tagHashtags = tagsToHashtags.enabled
    ? newHashtagNames(hashtagNamesFromTags(tags, tagsToHashtags.excludedTags), textHashtags)
    : [];
  return {
    title: hasTitle(metadata.title) ? metadata.title.trim() : "",
    description: typeof frontMatter.description === "string" ? frontMatter.description.trim() : "",
    url: address,
    blogFolder: blog.path,
    blogId: blog.id,
    tags,
    contentHtml: socialContentHtml(content),
    contentText: proseText(content).replace(/\s+/g, " ").trim(),
    textHashtags,
    tagHashtags,
  };
}

/**
 * Finishes one post's page.
 *
 * Args:
 *     metadata: The post's metadata from the blog plugin.
 *     blog: The post's blog, from loadedBlogs.
 *     tagLabels: Map of the blog's tags-file keys to labels.
 *     options: The plugin's settings, with template files read.
 *     context: { outDir, siteUrl, baseUrl, trailingSlash, cacheDir }.
 *
 * Returns:
 *     A promise of { entry, images, problem }: entry is the post's
 *     crosspost.json entry ({ source, url, date }), or null for unlisted
 *     posts (which still get their markup); images is how many images
 *     were attached; problem is "no page" or "no markup" when the page
 *     couldn't be finished, else null.
 */
export async function finishPostPage(metadata, blog, tagLabels, options, context) {
  const file = await postPageFile(metadata.permalink, context);
  if (!file) return { entry: null, images: 0, problem: "no page" };
  const html = await fs.readFile(file, "utf8");
  const page = findPostPage(html);
  if (!page) return { entry: null, images: 0, problem: "no markup" };

  const address = postAddress(metadata.permalink, { url: context.siteUrl, baseUrl: context.baseUrl, trailingSlash: context.trailingSlash });
  const post = describePost(metadata, page.content, blog, address, tagLabels, options.tagsToHashtags);
  const { template, fromSettings } = chooseTemplate(options.socialPostTemplates, post);
  const socialText = template ? renderTemplate(template, post) : "";
  const attachImages = options.images.enabled && (post.title === "" || (fromSettings && socialText !== ""));

  const images = DomUtils.findAll((el) => el.name === "img", [page.content]);
  const photos = attachImages ? await socialPhotos(images, address, options.images, context) : [];
  const hashtags = [...post.textHashtags, ...post.tagHashtags];

  await writeFileSafely(file, insertAtEnd(html, page.details, addedMarkup(socialText, options.networks, photos, hashtags)));
  if (metadata.unlisted) return { entry: null, images: photos.length, problem: null };
  const source = String(metadata.source || "").replace(/^@site\//, "");
  return { entry: { source, url: address, date: new Date(metadata.date).toISOString() }, images: photos.length, problem: null };
}

/**
 * Builds crosspost.json: what the "send" command needs to know.
 *
 * Args:
 *     options: The plugin's settings.
 *     blogs: From loadedBlogs.
 *     entries: { source, url, date } for each published post.
 *
 * Returns:
 *     { generator, version, networks, blogs, posts }: blogs gives each
 *     blog's id, content folder and include and exclude patterns; posts are
 *     sorted by source file.
 */
export function manifestFor(options, blogs, entries) {
  return {
    generator: PLUGIN_NAME,
    version: MANIFEST_VERSION,
    networks: options.networks,
    blogs: blogs.map(({ id, path: folder, include, exclude }) => ({ id, path: folder, include, exclude })),
    posts: [...entries].sort((a, b) => a.source.localeCompare(b.source)),
  };
}

/**
 * Finishes every post page and writes crosspost.json.
 *
 * Called from the plugin's postBuild step, once per language.
 *
 * Args:
 *     options: The plugin's settings, with template files read.
 *     context: { plugins, siteDir, localizationDir, outDir, siteUrl,
 *         baseUrl, trailingSlash, cacheDir }, mostly from postBuild.
 *
 * Returns:
 *     A promise of { posts, images, withoutPage, withoutMarkup }: how many
 *     published posts were finished, how many images were attached, and
 *     the source files of posts whose page wasn't found or had no markup.
 */
export async function finishPostPages(options, context) {
  const blogs = loadedBlogs(context.plugins, context.siteDir, context.localizationDir);
  const entries = [];
  const withoutPage = [];
  const withoutMarkup = [];
  let images = 0;
  for (const blog of blogs) {
    const tagLabels = await readTagLabels({ folder: blog.folder, localizedFolder: blog.localizedFolder, options: { tags: blog.tags } });
    for (const { metadata } of blog.posts) {
      const result = await finishPostPage(metadata, blog, tagLabels, options, context);
      if (result.problem === "no page") withoutPage.push(metadata.source);
      if (result.problem === "no markup") withoutMarkup.push(metadata.source);
      if (result.entry) entries.push(result.entry);
      images += result.images;
    }
  }
  const manifest = manifestFor(options, blogs, entries);
  await writeFileSafely(path.join(context.outDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  return { posts: entries.length, images, withoutPage, withoutMarkup };
}

/**
 * Writes the text of a post's Mastodon and Bluesky copies.
 *
 * Bridgy normally builds a social post from the page itself: an untitled
 * post goes out in full, and a titled post goes out as just its title and a
 * link (Bridgy treats a post with a title as an "article"). A page can give
 * Bridgy its own text instead, in an element with the class
 * "e-bridgy-mastodon-content" or "e-bridgy-bluesky-content". Bridgy then
 * posts that text as a note: in full, with the post's images, and shortened
 * with a link back if it's too long for the network.
 * Docs: https://brid.gy/about (and maybe_inject_silo_content in Bridgy's
 * publish.py, which drops the title when this text is given)
 *
 * This file decides that text for each post, from the socialPostTemplates
 * setting or, when no rule matches, from the built-in templates below.
 * It turns the result into simple HTML (paragraphs and line breaks), which
 * Bridgy converts to plain text.
 * Tests: test/socialText.test.js
 */
import { comparisonForm, hashtagsIn, isTagInSet, nameSet } from "./shared/hashtags.js";

/**
 * Placeholders a template may use, and what each becomes:
 * - title: the post's title ("" for untitled posts);
 * - content: the post's text, with its paragraphs and links;
 * - description: the front matter "description" ("" if not set);
 * - url: the post's address;
 * - hashtags: the post's tags as hashtags (see tagsToHashtags), leaving out
 *   any the post's text already has;
 * - tags: the post's tag names, separated by commas.
 */
export const TEMPLATE_PLACEHOLDERS = ["title", "content", "description", "url", "hashtags", "tags"];

/**
 * Finds placeholders in a template that aren't in TEMPLATE_PLACEHOLDERS.
 *
 * Args:
 *     template: Template text.
 *
 * Returns:
 *     The unknown placeholder names, e.g. ["titel"]; empty if all are known.
 */
export function unknownPlaceholders(template) {
  return [...String(template).matchAll(/\{(\w+)\}/g)]
    .map((match) => match[1])
    .filter((name) => !TEMPLATE_PLACEHOLDERS.includes(name));
}

/**
 * Explains unknown placeholders, for error messages.
 *
 * Args:
 *     unknown: Names from unknownPlaceholders.
 *
 * Returns:
 *     A sentence naming them and listing the known ones.
 */
export function unknownPlaceholderMessage(unknown) {
  const known = TEMPLATE_PLACEHOLDERS.map((name) => `{${name}}`).join(", ");
  return `uses unknown placeholder(s) ${unknown.map((name) => `{${name}}`).join(", ")}. Known placeholders: ${known}`;
}

/**
 * The built-in text, used when no socialPostTemplates rule matches:
 * untitled posts go out in full with their tags as hashtags; titled posts
 * with a description or tags go out as "Title: link", the description and
 * the hashtags. Titled posts with neither get no text of their own, so
 * Bridgy posts them as an article (title and link; on Bluesky, a link card).
 */
export const BUILT_IN_TEMPLATES = {
  untitled: "{content}\n\n{hashtags}",
  titled: "{title}: {url}\n\n{description}\n\n{hashtags}",
};

/**
 * Tells whether a socialPostTemplates rule applies to a post.
 *
 * Within each list, ANY item is enough; the post must match ALL the lists
 * the rule gives. A blog is named by its content folder (its "path"
 * setting) or by its plugin "id". Names compare loosely (case, spaces and punctuation don't
 * matter), the same way as the excluded tag and hashtag lists.
 *
 * Args:
 *     appliesTo: The rule's "appliesTo" object; may be empty.
 *     post: The post's details, from describePost in src/postPages.js.
 *
 * Returns:
 *     True if the rule applies (also when appliesTo is empty).
 */
export function ruleAppliesTo(appliesTo, post) {
  if (appliesTo.blogs && !appliesTo.blogs.some((blog) => blog === post.blogId || sameFolder(blog, post.blogFolder))) return false;
  if (appliesTo.hashtags && !hasAnyName(post.textHashtags, appliesTo.hashtags)) return false;
  if (appliesTo.tags && !post.tags.some((tag) => isTagInSet(tag, nameSet(appliesTo.tags)))) return false;
  if (appliesTo.hasTitle !== undefined && appliesTo.hasTitle !== (post.title !== "")) return false;
  return true;
}

/**
 * Tells whether a list of hashtags includes any of some names.
 *
 * Args:
 *     hashtags: Hashtag names without "#".
 *     names: Names to look for, compared loosely.
 *
 * Returns:
 *     True if any hashtag matches any name.
 */
function hasAnyName(hashtags, names) {
  const wanted = nameSet(names);
  return hashtags.some((name) => wanted.has(comparisonForm(name)));
}

/**
 * Compares two blog folder paths, ignoring "./" and slashes at either end.
 *
 * Args:
 *     a: A folder path, e.g. "blog-ideas" or "./blog-ideas/".
 *     b: Another folder path; may be null.
 *
 * Returns:
 *     True if they name the same folder.
 */
export function sameFolder(a, b) {
  const tidy = (folder) => String(folder).replace(/^\.\//, "").replace(/^\/+|\/+$/g, "");
  return b !== null && b !== undefined && tidy(a) === tidy(b);
}

/**
 * Picks the template for a post.
 *
 * Args:
 *     rules: The socialPostTemplates setting, with template files already
 *         read (see loadTemplateFiles).
 *     post: The post's details.
 *
 * Returns:
 *     { template, fromSettings }: the template text, and whether it came
 *     from a socialPostTemplates rule (false for the built-in text).
 *     template is null when the post should get no text of its own (a
 *     titled post with no description or hashtags, and no matching rule).
 */
export function chooseTemplate(rules, post) {
  const rule = rules.find((candidate) => ruleAppliesTo(candidate.appliesTo || {}, post));
  if (rule) return { template: rule.template, fromSettings: true };
  if (post.title === "") return { template: BUILT_IN_TEMPLATES.untitled, fromSettings: false };
  if (post.description || post.tagHashtags.length) return { template: BUILT_IN_TEMPLATES.titled, fromSettings: false };
  return { template: null, fromSettings: false };
}

/**
 * Escapes text for HTML.
 *
 * Args:
 *     text: Any text.
 *
 * Returns:
 *     The text with &, <, > and " written as character references.
 */
export function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Works out each placeholder's value for one post.
 *
 * Args:
 *     post: The post's details.
 *
 * Returns:
 *     A Map from placeholder name to { text, html }: plain text (used to
 *     decide whether it's empty) and the HTML to insert.
 */
export function placeholderValues(post) {
  const hashtags = post.tagHashtags.map((name) => `#${name}`).join(" ");
  const tags = post.tags.map((tag) => tag.label).join(", ");
  const plain = (text) => ({ text, html: escapeHtml(text) });
  return new Map([
    ["title", plain(post.title)],
    ["content", { text: post.contentText, html: escapeHtml(post.contentText) }],
    ["description", plain(post.description)],
    ["url", { text: post.url, html: `<a href="${escapeHtml(post.url)}">${escapeHtml(post.url)}</a>` }],
    ["hashtags", plain(hashtags)],
    ["tags", plain(tags)],
  ]);
}

/**
 * Renders one line of a template.
 *
 * Args:
 *     line: The line's text, with placeholders.
 *     values: From placeholderValues.
 *
 * Returns:
 *     The line as HTML, or null when any placeholder in it is empty, so a
 *     line like "{title}" disappears for untitled posts.
 */
function renderLine(line, values) {
  let empty = false;
  const html = escapeHtml(line).replace(/\{(\w+)\}/g, (_, name) => {
    const value = values.get(name);
    if (!value || value.text.trim() === "") empty = true;
    return value ? value.html : "";
  });
  return empty ? null : html;
}

/**
 * Adds hashtags to the end of a post's last paragraph when that paragraph
 * is only hashtags, so "#Quote" and "#Climate" share one line.
 *
 * Args:
 *     contentHtml: The post's text as HTML.
 *     hashtagsHtml: The hashtags to add, as HTML.
 *
 * Returns:
 *     The updated HTML, or null when the last paragraph isn't only hashtags.
 */
export function appendToHashtagParagraph(contentHtml, hashtagsHtml) {
  const match = /<p>((?:(?!<p>)[\s\S])*)<\/p>\s*$/.exec(contentHtml);
  if (!match) return null;
  const text = match[1].replace(/<[^>]*>/g, "").trim();
  const words = text.split(/\s+/);
  if (!text || hashtagsIn(text).length !== words.length || !words.every((word) => word.startsWith("#"))) return null;
  return `${contentHtml.slice(0, match.index)}<p>${match[1]} ${hashtagsHtml}</p>`;
}

/**
 * Renders a template for one post as simple HTML.
 *
 * A blank line in the template starts a new paragraph; a single line break
 * stays a line break. A paragraph that is only "{content}" keeps the post's
 * own paragraphs, lists and links; "{content}" mixed with other text
 * becomes plain text. A line is left out when any placeholder in it is
 * empty. A paragraph that is only "{hashtags}" right after "{content}"
 * joins the post's last line when that line is only hashtags.
 *
 * Args:
 *     template: The template text.
 *     post: The post's details.
 *
 * Returns:
 *     The HTML, or "" when nothing is left.
 */
export function renderTemplate(template, post) {
  const values = placeholderValues(post);
  const blocks = [];
  let previousWasContent = false;
  // Windows line endings ("\r\n") count as plain newlines.
  for (const block of template.replace(/\r\n?/g, "\n").split(/\n[ \t]*\n/)) {
    const trimmed = block.trim();
    if (trimmed === "{content}") {
      if (post.contentHtml.trim()) blocks.push(post.contentHtml.trim());
      previousWasContent = Boolean(post.contentHtml.trim());
      continue;
    }
    const lines = trimmed.split("\n").map((line) => renderLine(line.trim(), values)).filter((line) => line);
    if (lines.length === 0) continue;
    const html = lines.join("<br>");
    const merged = trimmed === "{hashtags}" && previousWasContent && appendToHashtagParagraph(blocks.at(-1), html);
    if (merged) blocks[blocks.length - 1] = merged;
    else blocks.push(`<p>${html}</p>`);
    previousWasContent = false;
  }
  return blocks.join("");
}

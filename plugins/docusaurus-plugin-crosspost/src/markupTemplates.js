/**
 * Renders social post templates written in Markdown (.md files).
 *
 * A template file is read the way its extension says:
 * - .txt: plain text (see renderTemplate in socialText.js);
 * - .md: Markdown, as Docusaurus reads it: CommonMark plus GitHub's
 *   extensions (GFM), so **bold**, _italics_, [links](https://example.com),
 *   lists, headings and HTML work, and a single line break joins two lines
 *   into one paragraph. Front matter at the top and HTML comments are left
 *   out, so both can hold notes to yourself.
 * Docs: https://docusaurus.io/docs/markdown-features
 *       https://github.github.com/gfm/
 *
 * The placeholders ({title}, {content}, ...) and their rules are the same
 * as in plain text templates:
 * - a line that uses an empty placeholder is left out;
 * - "{content}" as a paragraph of its own keeps the post's paragraphs and
 *   links; anywhere else it is the post's plain text;
 * - a "{hashtags}" paragraph right after it joins the post's last line when
 *   that line is only hashtags.
 * A placeholder's value is never read as Markdown: a title with *stars* in
 * it stays as written.
 *
 * Bridgy turns the resulting HTML into the post's text, so formatting that
 * Mastodon or Bluesky can't show (bold, for example) is dropped there.
 * Docs: https://brid.gy/about#publish
 * Tests: test/markupTemplates.test.js
 */
import { TEMPLATE_PLACEHOLDERS, appendToHashtagParagraph, escapeHtml, placeholderValues } from "./socialText.js";

/** File extensions, and how a template file with each is read. */
export const TEMPLATE_FORMATS = { ".txt": "text", ".md": "markdown" };

/**
 * Removes a front matter block ("---" lines at the very top), as Docusaurus
 * does for Markdown files. An empty block ("---" then "---") counts too.
 *
 * Args:
 *     text: The file's text, with "\n" line endings.
 *
 * Returns:
 *     The text without its front matter.
 */
export function withoutFrontMatter(text) {
  return text.replace(/^---[ \t]*\n(?:[\s\S]*?\n)?---[ \t]*(?:\n|$)/, "");
}

/** HTML elements that are blocks, so line breaks between them mean nothing. */
const BLOCKS = new Set([
  "address", "blockquote", "dd", "details", "div", "dl", "dt", "figure", "h1", "h2", "h3", "h4", "h5", "h6",
  "hr", "li", "ol", "p", "pre", "section", "summary", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul",
]);

/** A placeholder in template text, like "{title}" (group 1 is the name). */
const PLACEHOLDER = /\{(\w+)\}/g;

/** An HTML comment. */
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

/**
 * Finds the placeholder names a line uses.
 *
 * Args:
 *     line: One line of template text.
 *
 * Returns:
 *     The names, like ["title", "url"].
 */
function placeholdersIn(line) {
  return [...line.matchAll(PLACEHOLDER)].map((match) => match[1]);
}

/**
 * Tells whether a line is a paragraph of its own, with a blank line (or
 * the start or end of the template) before and after it.
 *
 * Args:
 *     lines: The template's lines.
 *     index: The line's position.
 *
 * Returns:
 *     true when the lines around it are blank or missing.
 */
function isOwnParagraph(lines, index) {
  const blank = (line) => line === undefined || line.trim() === "";
  return blank(lines[index - 1]) && blank(lines[index + 1]);
}

/**
 * Leaves out each line that uses an empty placeholder, as plain text
 * templates do. "{content}" as a paragraph of its own counts as empty only
 * when the post has no HTML at all, so a post that is only a photo keeps it.
 *
 * Args:
 *     template: The template text, with "\n" line endings.
 *     values: From placeholderValues.
 *     contentHtml: The post's own HTML.
 *
 * Returns:
 *     The template without those lines.
 */
export function withoutEmptyLines(template, values, contentHtml) {
  const isEmpty = (name) => values.has(name) && values.get(name).text.trim() === "";
  const lines = template.split("\n");
  const keep = (line, index) => {
    if (line.trim() === "{content}" && isOwnParagraph(lines, index)) return contentHtml.trim() !== "";
    return !placeholdersIn(line).some(isEmpty);
  };
  return lines.filter(keep).join("\n");
}

/**
 * Makes placeholder markers for one render. They are letters only, so
 * Markdown leaves them alone, and hold a random part, so text in a post
 * can't be mistaken for one.
 *
 * Returns:
 *     { marker(name), pattern }: the marker for a placeholder, and a global
 *     RegExp that finds any of them (group 1 is the name).
 */
function placeholderMarkers() {
  const letters = Array.from({ length: 12 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26)));
  const prefix = `QCROSSPOST${letters.join("")}`;
  return {
    marker: (name) => `${prefix}${name}Q`,
    pattern: new RegExp(`${prefix}(${TEMPLATE_PLACEHOLDERS.join("|")})Q`, "g"),
  };
}

/**
 * Puts a marker in place of each known placeholder, so Markdown can be
 * read without touching the values. Unknown names (stopped earlier, when
 * the file was read) stay as typed.
 *
 * Args:
 *     template: The template text.
 *     values: From placeholderValues.
 *     markers: From placeholderMarkers.
 *
 * Returns:
 *     The text with markers.
 */
function withMarkers(template, values, markers) {
  return template.replace(PLACEHOLDER, (whole, name) => (values.has(name) ? markers.marker(name) : whole));
}

/**
 * Tells whether an HTML tree node is a block, like a paragraph or list.
 *
 * Args:
 *     node: A hast node, or undefined.
 *
 * Returns:
 *     true for block elements and for the post's own content.
 */
function isBlock(node) {
  if (!node) return false;
  return node.isContent === true || (node.type === "element" && BLOCKS.has(node.tagName));
}

/**
 * Tells whether a node is a paragraph holding only one marker.
 *
 * Args:
 *     node: A hast node, or undefined.
 *     marker: The marker text.
 *
 * Returns:
 *     true for <p>marker</p>.
 */
function isMarkerParagraph(node, marker) {
  if (!node || node.type !== "element" || node.tagName !== "p" || node.children.length !== 1) return false;
  const [only] = node.children;
  return only.type === "text" && only.value.trim() === marker;
}

/**
 * Puts the post's own HTML in place of a "{content}" paragraph, and joins
 * a "{hashtags}" paragraph right after it to the post's last line when
 * that line is only hashtags.
 *
 * Args:
 *     root: The HTML tree's root (changed in place).
 *     context: { values, markers, contentHtml }.
 */
function fillContentParagraphs(root, context) {
  const { values, markers, contentHtml } = context;
  const children = [];
  for (const node of root.children) {
    const previous = children.findLast((child) => !(child.type === "text" && child.value.trim() === ""));
    if (isMarkerParagraph(node, markers.marker("content"))) {
      if (contentHtml) children.push({ type: "raw", value: contentHtml, isContent: true });
      continue;
    }
    if (isMarkerParagraph(node, markers.marker("hashtags")) && previous?.isContent) {
      const merged = appendToHashtagParagraph(previous.value, values.get("hashtags").html);
      if (merged) {
        previous.value = merged;
        continue;
      }
    }
    children.push(node);
  }
  root.children = children;
}

/**
 * Replaces markers with the values' plain text.
 *
 * Args:
 *     text: Text that may hold markers.
 *     context: { values, markers }.
 *
 * Returns:
 *     The text with values.
 */
function markersAsText(text, context) {
  return text.replace(context.markers.pattern, (whole, name) => context.values.get(name).text);
}

/**
 * Makes the nodes for one placeholder's value. {url} becomes a link,
 * unless it is already inside one; anything else is text.
 *
 * Args:
 *     name: The placeholder's name.
 *     insideLink: Whether the text is inside a link.
 *     values: From placeholderValues.
 *
 * Returns:
 *     A hast node.
 */
function valueNode(name, insideLink, values) {
  const text = values.get(name).text;
  if (name !== "url" || insideLink) return { type: "text", value: text };
  return { type: "element", tagName: "a", properties: { href: text }, children: [{ type: "text", value: text }] };
}

/**
 * Splits text that holds markers into text and value nodes.
 *
 * Args:
 *     text: The text.
 *     insideLink: Whether the text is inside a link.
 *     context: { values, markers }.
 *
 * Returns:
 *     The hast nodes, in order.
 */
function textNodes(text, insideLink, context) {
  const nodes = [];
  let last = 0;
  for (const match of text.matchAll(context.markers.pattern)) {
    if (match.index > last) nodes.push({ type: "text", value: text.slice(last, match.index) });
    nodes.push(valueNode(match[1], insideLink, context.values));
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push({ type: "text", value: text.slice(last) });
  return nodes;
}

/**
 * Puts values into an element's attributes, like a link's href, as text.
 *
 * Args:
 *     node: A hast node (changed in place).
 *     context: { values, markers }.
 */
function fillAttributes(node, context) {
  for (const [key, value] of Object.entries(node.properties || {})) {
    if (typeof value === "string") node.properties[key] = markersAsText(value, context);
    else if (Array.isArray(value)) node.properties[key] = value.map((item) => (typeof item === "string" ? markersAsText(item, context) : item));
  }
}

/**
 * Prepares HTML written in the template: comments are left out, and
 * values go in as escaped text.
 *
 * Args:
 *     node: A hast "raw" node.
 *     context: { values, markers }.
 *
 * Returns:
 *     The new node, or null when nothing is left.
 */
function filledRaw(node, context) {
  const html = node.value
    .replace(HTML_COMMENT, "")
    .replace(context.markers.pattern, (whole, name) => escapeHtml(context.values.get(name).text));
  return html.trim() === "" ? null : { ...node, value: html };
}

/**
 * Tells whether a text node is only a line break that Markdown left
 * between blocks or at the edge of an element, which means nothing.
 *
 * Args:
 *     siblings: The parent's children.
 *     index: The text node's position.
 *
 * Returns:
 *     true when the node can be left out.
 */
function isLayoutLineBreak(siblings, index) {
  const node = siblings[index];
  if (node.value.trim() !== "" || !node.value.includes("\n")) return false;
  const atEdge = index === 0 || index === siblings.length - 1;
  return atEdge || isBlock(siblings[index - 1]) || isBlock(siblings[index + 1]);
}

/**
 * Removes the line break Markdown keeps after a hard break (<br>).
 *
 * Args:
 *     siblings: The parent's children.
 *     index: The text node's position.
 *
 * Returns:
 *     The text node's value, without that line break.
 */
function textAfterHardBreak(siblings, index) {
  const previous = siblings[index - 1];
  const value = siblings[index].value;
  return previous?.type === "element" && previous.tagName === "br" ? value.replace(/^\n/, "") : value;
}

/**
 * Puts the values into a node and everything inside it.
 *
 * Args:
 *     node: A hast node (changed in place).
 *     insideLink: Whether the node is inside a link.
 *     context: { values, markers }.
 */
function fillNode(node, insideLink, context) {
  fillAttributes(node, context);
  if (!node.children) return;
  const inLink = insideLink || (node.type === "element" && node.tagName === "a");
  const children = [];
  node.children.forEach((child, index, siblings) => {
    if (child.isContent) {
      children.push(child);
    } else if (child.type === "comment") {
      // Notes to yourself: left out.
    } else if (child.type === "raw") {
      const raw = filledRaw(child, context);
      if (raw) children.push(raw);
    } else if (child.type === "text") {
      if (isLayoutLineBreak(siblings, index)) return;
      const value = textAfterHardBreak(siblings, index);
      if (value) children.push(...textNodes(value, inLink, context));
    } else {
      fillNode(child, inLink, context);
      children.push(child);
    }
  });
  node.children = children;
}

/**
 * Makes a rehype plugin that puts the post's values into the HTML tree.
 *
 * Args:
 *     context: { values, markers, contentHtml }.
 *
 * Returns:
 *     The plugin, for unified's use().
 */
function fillPlaceholders(context) {
  return () => (tree) => {
    fillContentParagraphs(tree, context);
    fillNode(tree, false, context);
  };
}

/** The Markdown libraries, loaded on first use. */
let markdownLibraries;

/**
 * Loads the Markdown libraries once. They are loaded with import(), and
 * only when a Markdown template is used, so these ES modules load natively
 * even when Docusaurus reads the config through its CommonJS loader.
 *
 * Returns:
 *     A promise of { unified, remarkParse, remarkGfm, remarkRehype,
 *     rehypeStringify }.
 */
function loadMarkdownLibraries() {
  markdownLibraries ??= Promise.all([
    import("unified"),
    import("remark-parse"),
    import("remark-gfm"),
    import("remark-rehype"),
    import("rehype-stringify"),
  ]).then(([unified, remarkParse, remarkGfm, remarkRehype, rehypeStringify]) => ({
    unified: unified.unified,
    remarkParse: remarkParse.default,
    remarkGfm: remarkGfm.default,
    remarkRehype: remarkRehype.default,
    rehypeStringify: rehypeStringify.default,
  }));
  return markdownLibraries;
}

/**
 * Renders a Markdown template for one post as HTML.
 *
 * Args:
 *     template: The template text (front matter already removed).
 *     post: The post's details.
 *     file: The template file's path, for error messages.
 *
 * Returns:
 *     A promise of the HTML, or "" when nothing is left.
 *
 * Raises:
 *     Error: If the Markdown can't be read, naming the file.
 */
export async function renderMarkdownTemplate(template, post, file) {
  const { unified, remarkParse, remarkGfm, remarkRehype, rehypeStringify } = await loadMarkdownLibraries();
  const values = placeholderValues(post);
  const markers = placeholderMarkers();
  const contentHtml = post.contentHtml.trim();
  const kept = withoutEmptyLines(template.replace(/\r\n?/g, "\n"), values, contentHtml);
  try {
    const result = await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(fillPlaceholders({ values, markers, contentHtml }))
      .use(rehypeStringify, { allowDangerousHtml: true })
      .process(withMarkers(kept, values, markers));
    return String(result).trim();
  } catch (error) {
    throw new Error(`Social post template ${file || "(inline)"} can't be read as Markdown: ${error.message}`);
  }
}

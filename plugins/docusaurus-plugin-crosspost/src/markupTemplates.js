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

const isBlock = (node) => Boolean(node) && ((node.type === "element" && BLOCKS.has(node.tagName)) || node.isContent === true);
const isBlank = (node) => node.type === "text" && node.value.trim() === "";

/**
 * Makes placeholder markers for one render. They are letters only, so
 * Markdown leaves them alone, and include a random part, so text in a post
 * can't be mistaken for one.
 *
 * Returns:
 *     { marker(name), pattern }: the marker for a placeholder, and a global
 *     RegExp that finds any of them (group 1 is the name).
 */
function placeholderMarkers() {
  const nonce = Array.from({ length: 12 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("");
  const marker = (name) => `QCROSSPOST${nonce}${name}Q`;
  return { marker, pattern: new RegExp(`QCROSSPOST${nonce}(${TEMPLATE_PLACEHOLDERS.join("|")})Q`, "g") };
}

/**
 * A rehype plugin that puts the post's values in place of the markers.
 *
 * Args:
 *     values: From placeholderValues.
 *     markers: From placeholderMarkers.
 *     contentHtml: The post's own HTML, for a "{content}" paragraph.
 *
 * Returns:
 *     The plugin (a function that changes the HTML tree).
 */
function fillPlaceholders(values, markers, contentHtml) {
  const { marker, pattern } = markers;
  const textOf = (name) => values.get(name).text;
  const asText = (value) => value.replace(pattern, (whole, name) => textOf(name));
  const onlyMarker = (node, name) =>
    Boolean(node) && node.type === "element" && node.tagName === "p" &&
    node.children.length === 1 && node.children[0].type === "text" && node.children[0].value.trim() === marker(name);

  /** "{content}" and "{hashtags}" paragraphs at the top level. */
  function fillContentParagraphs(root) {
    const children = [];
    for (const node of root.children) {
      const previous = children.findLast((child) => !isBlank(child));
      if (onlyMarker(node, "content")) {
        children.push({ type: "raw", value: contentHtml, isContent: true });
      } else if (onlyMarker(node, "hashtags") && previous && previous.isContent) {
        const merged = appendToHashtagParagraph(previous.value, values.get("hashtags").html);
        if (merged) previous.value = merged;
        else children.push(node);
      } else {
        children.push(node);
      }
    }
    root.children = children.filter((node) => !(node.isContent && node.value === ""));
  }

  /** Text with markers, as nodes: text, and a link for {url} outside links. */
  function splitText(value, insideLink) {
    const nodes = [];
    let last = 0;
    for (const match of value.matchAll(pattern)) {
      if (match.index > last) nodes.push({ type: "text", value: value.slice(last, match.index) });
      const name = match[1];
      if (name === "url" && !insideLink) {
        nodes.push({ type: "element", tagName: "a", properties: { href: textOf("url") }, children: [{ type: "text", value: textOf("url") }] });
      } else {
        nodes.push({ type: "text", value: textOf(name) });
      }
      last = match.index + match[0].length;
    }
    if (last < value.length) nodes.push({ type: "text", value: value.slice(last) });
    return nodes;
  }

  function fill(node, insideLink) {
    // Attributes, like a link's href: a placeholder is its text.
    for (const [key, value] of Object.entries(node.properties || {})) {
      if (typeof value === "string") node.properties[key] = asText(value);
      else if (Array.isArray(value)) node.properties[key] = value.map((item) => (typeof item === "string" ? asText(item) : item));
    }
    if (!node.children) return;
    const inLink = insideLink || (node.type === "element" && node.tagName === "a");
    const children = [];
    node.children.forEach((child, index) => {
      if (child.isContent) {
        children.push(child);
      } else if (child.type === "comment") {
        // Notes to yourself: left out.
      } else if (child.type === "raw") {
        // HTML written in the template: comments go; values go in as text.
        const value = child.value.replace(/<!--[\s\S]*?-->/g, "").replace(pattern, (whole, name) => escapeHtml(textOf(name)));
        if (value.trim() !== "") children.push({ ...child, value });
      } else if (child.type === "text") {
        // Line breaks between blocks mean nothing; leave them out.
        const between = isBlank(child) && child.value.includes("\n") &&
          (index === 0 || index === node.children.length - 1 || isBlock(node.children[index - 1]) || isBlock(node.children[index + 1]));
        const previous = node.children[index - 1];
        // Markdown keeps the line break after a hard break (<br>); drop it.
        const value = previous && previous.type === "element" && previous.tagName === "br" ? child.value.replace(/^\n/, "") : child.value;
        if (!between && value) children.push(...splitText(value, inLink));
      } else {
        fill(child, inLink);
        children.push(child);
      }
    });
    node.children = children;
  }

  return () => (tree) => {
    fillContentParagraphs(tree);
    fill(tree, false);
  };
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
  // Loaded with import(), and only when a Markdown template is used, so
  // these ES modules load natively even when Docusaurus reads the config
  // through its CommonJS loader.
  const [{ unified }, { default: remarkParse }, { default: remarkGfm }, { default: remarkRehype }, { default: rehypeStringify }] =
    await Promise.all([import("unified"), import("remark-parse"), import("remark-gfm"), import("remark-rehype"), import("rehype-stringify")]);

  const values = placeholderValues(post);
  const markers = placeholderMarkers();
  const isEmpty = (name) => values.has(name) && values.get(name).text.trim() === "";
  // A line that uses an empty placeholder is left out, as in plain text. A
  // "{content}" line of its own stays while the post has any HTML (a photo,
  // say), as renderTemplate does.
  const keep = (line) =>
    line.trim() === "{content}"
      ? post.contentHtml.trim() !== ""
      : ![...line.matchAll(/\{(\w+)\}/g)].some((match) => isEmpty(match[1]));
  const source = template
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter(keep)
    .join("\n")
    .replace(/\{(\w+)\}/g, (whole, name) => (values.has(name) ? markers.marker(name) : whole));

  try {
    const result = await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(fillPlaceholders(values, markers, post.contentHtml.trim()))
      .use(rehypeStringify, { allowDangerousHtml: true })
      .process(source);
    return String(result).trim();
  } catch (error) {
    throw new Error(`Social post template ${file || "(inline)"} can't be read as Markdown: ${error.message}`);
  }
}

/**
 * Reads the template files named by socialPostTemplates rules.
 *
 * A rule can give its text inline ("template") or in a file
 * ("templateFile"). Files live in the folder set by templatesPath, which is
 * relative to the site folder, like a blog's "path" setting; each
 * templateFile is relative to that folder, like a blog's "tags" file is
 * relative to the blog's folder. The extension says how a file is read:
 * .txt as plain text and .md as Markdown (see markupTemplates.js). A .md
 * file may start with front matter, which is left out, as in Docusaurus.
 * Docs: https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog#configuration
 *
 * Files are read once, when Docusaurus loads the plugin, so a missing file
 * or an unknown placeholder stops the build at the start with a message
 * naming the file. Templates are only used by the postBuild step, which
 * Docusaurus runs for production builds ("docusaurus build"), not while
 * "docusaurus start" runs, so there is nothing to reload during development.
 * Docs: https://docusaurus.io/docs/api/plugin-methods/lifecycle-apis#postBuild
 * Tests: test/templateFiles.test.js
 */
import fs from "node:fs";
import path from "node:path";
import { PLUGIN_NAME } from "./shared/names.js";
import { unknownPlaceholderMessage, unknownPlaceholders } from "./socialText.js";
import { TEMPLATE_FORMATS, withoutFrontMatter } from "./markupTemplates.js";

/**
 * Finds the folder holding template files.
 *
 * Args:
 *     templatesPath: The templatesPath setting; relative to the site
 *         folder, or absolute.
 *     siteDir: The site folder.
 *
 * Returns:
 *     The folder's absolute path.
 */
export function templatesFolder(templatesPath, siteDir) {
  return path.resolve(siteDir, templatesPath);
}

/**
 * Works out how a template file is read, from its extension.
 *
 * Args:
 *     file: The template file's path.
 *     label: How to name the rule in messages, like
 *         'socialPostTemplates[0] names the template file "a.html"'.
 *
 * Returns:
 *     "text" (.txt) or "markdown" (.md), in any letter case.
 *
 * Raises:
 *     Error: For any other extension, with a hint for .mdx.
 */
export function templateFormat(file, label) {
  const extension = path.extname(file).toLowerCase();
  const format = TEMPLATE_FORMATS[extension];
  if (format) return format;
  const hint = extension === ".mdx" ? "; MDX isn't supported, so use .md." : ".";
  throw new Error(`[${PLUGIN_NAME}] ${label}. Template files must end in .txt (plain text) or .md (Markdown)${hint}`);
}

/**
 * Reads a template file's text.
 *
 * Args:
 *     file: The template file's path.
 *     label: How to name the rule in messages (see templateFormat).
 *     templatesPath: The templatesPath setting, for the message.
 *
 * Returns:
 *     The text, with "\n" line endings and without a byte order mark
 *     (which some Windows editors add).
 *
 * Raises:
 *     Error: If the file can't be read.
 */
export function readTemplateText(file, label, templatesPath) {
  try {
    return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  } catch (error) {
    throw new Error(
      `[${PLUGIN_NAME}] ${label}, but ${file} can't be read (${error.code}). ` +
        `Template files are relative to templatesPath ("${templatesPath}").`
    );
  }
}

/**
 * Reads each rule's template file into its "template".
 *
 * Args:
 *     rules: The socialPostTemplates setting.
 *     templatesPath: The templatesPath setting.
 *     siteDir: The site folder.
 *
 * Returns:
 *     The rules, each with "template" holding its text, "format" ("text" or
 *     "markdown") and "file" (its path); rules written inline are
 *     returned unchanged. A Markdown file's front matter and any file's
 *     final line break are removed.
 *
 * Raises:
 *     Error: If a file has another extension, can't be read or uses an
 *         unknown placeholder, naming the file.
 */
export function loadTemplateFiles(rules, templatesPath, siteDir) {
  const folder = templatesFolder(templatesPath, siteDir);
  return rules.map((rule, index) => {
    if (!rule.templateFile) return rule;
    const file = path.resolve(folder, rule.templateFile);
    const label = `socialPostTemplates[${index}] names the template file "${rule.templateFile}"`;
    const format = templateFormat(file, label);
    let text = readTemplateText(file, label, templatesPath);
    if (format === "markdown") text = withoutFrontMatter(text);
    text = text.replace(/\n$/, "");
    const unknown = unknownPlaceholders(text);
    if (unknown.length) throw new Error(`[${PLUGIN_NAME}] Template file ${file} ${unknownPlaceholderMessage(unknown)}`);
    return { ...rule, template: text, format, file };
  });
}

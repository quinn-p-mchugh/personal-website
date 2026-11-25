/**
 * Reads the template files named by socialPostTemplates rules.
 *
 * A rule can give its text inline ("template") or in a file
 * ("templateFile"). Files live in the folder set by templatesPath, which is
 * relative to the site folder, like a blog's "path" setting; each
 * templateFile is relative to that folder, like a blog's "tags" file is
 * relative to the blog's folder.
 * Docs: https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog#configuration
 *
 * Files are read once, when Docusaurus loads the plugin, so a missing file
 * or an unknown placeholder stops the build at the start with a message
 * naming the file. During "docusaurus start", editing a template file
 * reloads the site (see getPathsToWatch in src/index.js).
 * Tests: test/templateFiles.test.js
 */
import fs from "node:fs";
import path from "node:path";
import { PLUGIN_NAME } from "./shared/names.js";
import { unknownPlaceholderMessage, unknownPlaceholders } from "./socialText.js";

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
 * Lists the template files the rules use.
 *
 * Args:
 *     rules: The socialPostTemplates setting.
 *     templatesPath: The templatesPath setting.
 *     siteDir: The site folder.
 *
 * Returns:
 *     Absolute paths of the files, without repeats.
 */
export function templateFilePaths(rules, templatesPath, siteDir) {
  const folder = templatesFolder(templatesPath, siteDir);
  return [...new Set(rules.filter((rule) => rule.templateFile).map((rule) => path.resolve(folder, rule.templateFile)))];
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
 *     The rules, each with "template" holding its text; rules written
 *     inline are returned unchanged. A file's final line break is removed.
 *
 * Raises:
 *     Error: If a file can't be read or uses an unknown placeholder,
 *         naming the file.
 */
export function loadTemplateFiles(rules, templatesPath, siteDir) {
  const folder = templatesFolder(templatesPath, siteDir);
  return rules.map((rule, index) => {
    if (!rule.templateFile) return rule;
    const file = path.resolve(folder, rule.templateFile);
    let text;
    try {
      text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").replace(/\n$/, "");
    } catch (error) {
      throw new Error(
        `[${PLUGIN_NAME}] socialPostTemplates[${index}] names the template file "${rule.templateFile}", ` +
          `but ${file} can't be read (${error.code}). Template files are relative to templatesPath ("${templatesPath}").`
      );
    }
    const unknown = unknownPlaceholders(text);
    if (unknown.length) throw new Error(`[${PLUGIN_NAME}] Template file ${file} ${unknownPlaceholderMessage(unknown)}`);
    return { ...rule, template: text };
  });
}

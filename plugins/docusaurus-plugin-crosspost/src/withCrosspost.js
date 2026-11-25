/**
 * Sets up the whole plugin in a Docusaurus config with one call:
 *
 *     import { withCrosspost } from "docusaurus-plugin-crosspost";
 *     const config = { ... };
 *     export default withCrosspost(config, { webmentionUsername: "example.com" });
 *
 * It does two things:
 * 1. if hashtagsToTags is on, adds the hashtags-to-tags step
 *    (src/hashtagsToTags.js) as the site's markdown.parseFrontMatter,
 *    keeping any parseFrontMatter you already had (yours runs first). A
 *    plugin can't set this site-wide hook itself.
 *    Docs: https://docusaurus.io/docs/api/docusaurus-config#markdown
 * 2. adds the plugin itself, with your settings.
 * It finds blogs in the classic preset's "blog" and in every
 * "@docusaurus/plugin-content-blog" entry, so blogs you add later are
 * covered without changing this call.
 *
 * Tests: test/withCrosspost.test.js
 */
import { fileURLToPath } from "node:url";
import { blogOptionObjects, blogSummary } from "./blogs.js";
import { createParseFrontMatter } from "./hashtagsToTags.js";
import { normalizeOptions } from "./options.js";
import { PLUGIN_NAME } from "./shared/names.js";

/** This plugin's entry file, so Docusaurus loads it like any other plugin. */
const PLUGIN_ENTRY = fileURLToPath(new URL("./index.js", import.meta.url));

/**
 * Adds the plugin and its build steps to a Docusaurus config.
 *
 * Args:
 *     siteConfig: Your Docusaurus config object. It is changed in place and
 *         also returned, so it can be exported directly.
 *     options: The plugin's settings; see src/options.js or README.md.
 *
 * Returns:
 *     The same config, set up for cross-posting.
 *
 * Raises:
 *     Error: If a setting is wrong, naming it.
 */
export default function withCrosspost(siteConfig, options = {}) {
  const settings = normalizeOptions(options);
  const blogs = blogOptionObjects(siteConfig);
  if (!blogs.length) {
    console.warn(`[${PLUGIN_NAME}] No blogs found in the config, so nothing will be cross-posted.`);
  }

  if (settings.hashtagsToTags.enabled) {
    const markdown = siteConfig.markdown || {};
    siteConfig.markdown = {
      ...markdown,
      parseFrontMatter: createParseFrontMatter({
        blogs: blogs.map(blogSummary),
        hashtagsToTags: settings.hashtagsToTags,
        previous: markdown.parseFrontMatter,
      }),
    };
  }

  siteConfig.plugins = [...(siteConfig.plugins || []), [PLUGIN_ENTRY, options]];
  return siteConfig;
}

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
 * The plugin itself reads the blogs Docusaurus loaded, so every way of
 * setting up a blog works, including blogs you add later.
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
 * Accepts the config the way Docusaurus does: an object, or a function
 * (also async) that creates one. A function gets back a function, so
 * Docusaurus still calls it when it loads the config.
 * Docs: https://docusaurus.io/docs/api/docusaurus-config
 *
 * Args:
 *     siteConfig: Your Docusaurus config: an object (changed in place and
 *         returned), a function or async function returning one, or a
 *         promise of one.
 *     options: The plugin's settings; see src/options.js or README.md.
 *
 * Returns:
 *     The config set up for cross-posting, in the same form as given.
 *
 * Raises:
 *     Error: If a setting is wrong, naming it.
 */
export default function withCrosspost(siteConfig, options = {}) {
  const settings = normalizeOptions(options); // checks settings straight away, in every form
  if (typeof siteConfig === "function") {
    return async (...args) => addCrosspost(await siteConfig(...args), options, settings);
  }
  if (siteConfig && typeof siteConfig.then === "function") {
    return siteConfig.then((config) => addCrosspost(config, options, settings));
  }
  return addCrosspost(siteConfig, options, settings);
}

/**
 * Adds the plugin and its build steps to a config object.
 *
 * Args:
 *     siteConfig: The Docusaurus config object; changed in place.
 *     options: The plugin's settings as written (passed on to the plugin,
 *         which Docusaurus checks again with validateOptions).
 *     settings: The same settings with defaults filled in.
 *
 * Returns:
 *     The same config object.
 */
function addCrosspost(siteConfig, options, settings) {
  if (settings.hashtagsToTags.enabled) {
    const blogs = blogOptionObjects(siteConfig);
    if (!blogs.length) {
      console.warn(
        `[${PLUGIN_NAME}] hashtagsToTags is on, but no blog was found in the config's presets or plugins, so no hashtags will become tags. Blogs added by other presets or by plugin functions can't be seen before plugins load.`
      );
    }
    const markdown = siteConfig.markdown || {};
    siteConfig.markdown = {
      ...markdown,
      parseFrontMatter: createParseFrontMatter({
        blogs: blogs.map(blogSummary),
        hashtagsToTags: settings.hashtagsToTags,
        i18nPath: (siteConfig.i18n && siteConfig.i18n.path) || "i18n",
        previous: markdown.parseFrontMatter,
      }),
    };
  }

  siteConfig.plugins = [...(siteConfig.plugins || []), [PLUGIN_ENTRY, options]];
  return siteConfig;
}

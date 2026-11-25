/**
 * docusaurus-plugin-crosspost: cross-posts Docusaurus blog posts to
 * Mastodon and Bluesky through Bridgy, and shows the replies, likes and
 * reposts from there under each post.
 *
 * Set it up with withCrosspost (src/withCrosspost.js), which adds this
 * plugin and the build steps it needs to your config in one call. See
 * README.md for what each part does and how to set up Bridgy.
 *
 * What this file does, as a Docusaurus plugin:
 * - getThemePath: adds the theme components that mark posts up for Bridgy
 *   (src/theme/BlogPostItem) and show responses (src/components).
 * - injectHtmlTags: adds the webmention and rel="me" links to every page.
 * - contentLoaded: shares the settings with those components.
 * - postBuild: attaches images to social posts (src/images.js).
 * Plugin docs: https://docusaurus.io/docs/api/plugin-methods
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addSocialImages } from "./images.js";
import { PLUGIN_NAME } from "./shared/names.js";

export { validateOptions } from "./options.js";
export { default as withCrosspost } from "./withCrosspost.js";

/**
 * Builds the <head> links every page needs.
 *
 * "webmention" tells Bridgy where to send Mastodon and Bluesky responses.
 * "me" links prove you own the site, for signing in to webmention.io.
 * Docs: https://webmention.io/ and https://indielogin.com/setup
 *
 * Args:
 *     options: The plugin's settings.
 *
 * Returns:
 *     Tag descriptions in Docusaurus's injectHtmlTags format.
 */
export function headTags(options) {
  const tags = [];
  if (options.webmentionUsername) {
    const href = `https://webmention.io/${encodeURIComponent(options.webmentionUsername)}/webmention`;
    tags.push({ tagName: "link", attributes: { rel: "webmention", href } });
  }
  for (const href of options.relMe) tags.push({ tagName: "link", attributes: { rel: "me", href } });
  return tags;
}

/**
 * The settings the theme components need, shared with the browser.
 *
 * Only these are shared, so nothing else ends up in the site's JavaScript.
 *
 * Args:
 *     options: The plugin's settings.
 *
 * Returns:
 *     { networks, showResponses, webmentionUsername, tagsToHashtags }.
 */
export function browserSettings(options) {
  const { networks, showResponses, webmentionUsername, tagsToHashtags } = options;
  return { networks, showResponses, webmentionUsername, tagsToHashtags };
}

/**
 * The plugin itself, called by Docusaurus.
 *
 * Args:
 *     context: Docusaurus's plugin context (siteDir, siteConfig, ...).
 *     options: The settings, already checked by validateOptions.
 *
 * Returns:
 *     The plugin's lifecycle methods.
 */
export default function crosspostPlugin(context, options) {
  return {
    name: PLUGIN_NAME,

    getThemePath() {
      return fileURLToPath(new URL("./theme", import.meta.url));
    },

    injectHtmlTags() {
      return { headTags: headTags(options) };
    },

    async contentLoaded({ actions }) {
      actions.setGlobalData(browserSettings(options));
    },

    async postBuild({ outDir }) {
      if (!options.images.enabled) return;
      const { pages, images } = await addSocialImages(options.images, {
        outDir,
        siteUrl: context.siteConfig.url,
        baseUrl: context.siteConfig.baseUrl,
        cacheDir: path.join(context.siteDir, "node_modules", ".cache", PLUGIN_NAME),
      });
      console.log(`[${PLUGIN_NAME}] Attached ${images} image(s) to the social posts of ${pages} post(s).`);
    },
  };
}

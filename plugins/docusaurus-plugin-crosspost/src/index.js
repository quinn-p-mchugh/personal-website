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
 * - contentLoaded: shares the few settings those components need.
 * - postBuild: adds each post's social text, hashtags and images, and
 *   writes crosspost.json (src/postPages.js).
 * Plugin docs: https://docusaurus.io/docs/api/plugin-methods
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { finishPostPages } from "./postPages.js";
import { loadTemplateFiles } from "./templateFiles.js";
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
 * Only these are shared: Docusaurus loads global data on every page, so
 * it should stay small.
 * Docs: https://docusaurus.io/docs/api/plugin-methods/lifecycle-apis#actions
 *
 * Args:
 *     options: The plugin's settings.
 *
 * Returns:
 *     { networks, showResponses, webmentionUsername }.
 */
export function browserSettings(options) {
  const { networks, showResponses, webmentionUsername } = options;
  return { networks, showResponses, webmentionUsername };
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
  // Read template files now, so a missing one stops the build at the start.
  const socialPostTemplates = loadTemplateFiles(options.socialPostTemplates, options.templatesPath, context.siteDir);

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

    async postBuild({ outDir, siteConfig }) {
      const { posts, images } = await finishPostPages({ ...options, socialPostTemplates }, {
        outDir,
        siteConfig,
        siteUrl: siteConfig.url,
        baseUrl: siteConfig.baseUrl,
        cacheDir: path.join(context.siteDir, "node_modules", ".cache", PLUGIN_NAME),
      });
      console.log(`[${PLUGIN_NAME}] Prepared ${posts} post(s) for cross-posting, with ${images} image(s).`);
    },
  };
}

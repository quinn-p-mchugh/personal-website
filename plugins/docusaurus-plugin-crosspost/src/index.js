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
 *   writes crosspost.json (src/postPages.js), using the blogs and posts
 *   Docusaurus loaded.
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
 * Tells whether the site uses Docusaurus's hash router, which builds one
 * page for the whole site instead of a page per post.
 * Docs: https://docusaurus.io/docs/api/docusaurus-config#future
 *
 * Args:
 *     siteConfig: The Docusaurus config.
 *
 * Returns:
 *     True when future.experimental_router is "hash".
 */
export function usesHashRouter(siteConfig) {
  return Boolean(siteConfig.future && siteConfig.future.experimental_router === "hash");
}

/**
 * Explains posts the build step couldn't finish.
 *
 * Args:
 *     result: From finishPostPages.
 *
 * Returns:
 *     Warning messages; empty when every post was finished.
 */
export function buildWarnings(result) {
  const messages = [];
  const list = (sources) => sources.slice(0, 5).join(", ") + (sources.length > 5 ? `, and ${sources.length - 5} more` : "");
  if (result.withoutMarkup.length) {
    messages.push(
      `${result.withoutMarkup.length} post page(s) have no cross-posting markup, so they won't be cross-posted: ${list(result.withoutMarkup)}. ` +
        "A BlogPostItem or BlogPostItem/Container component in src/theme that doesn't wrap the original, or a custom blogPostComponent setting, can cause this; see the README's \"Supported Docusaurus setups\"."
    );
  }
  if (result.withoutPage.length) {
    messages.push(`Couldn't find the built page of ${result.withoutPage.length} post(s), so they won't be cross-posted: ${list(result.withoutPage)}.`);
  }
  return messages;
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

    async postBuild({ outDir, siteConfig, siteDir, baseUrl, plugins, localizationDir }) {
      if (usesHashRouter(siteConfig)) {
        console.warn(
          `[${PLUGIN_NAME}] future.experimental_router is "hash", so the site has no page per post for Bridgy to read. Nothing was prepared for cross-posting.`
        );
        return;
      }
      const result = await finishPostPages(
        { ...options, socialPostTemplates },
        {
          plugins,
          siteDir,
          localizationDir,
          outDir,
          siteUrl: siteConfig.url,
          // The baseUrl of the language being built (with i18n, "/fr/" etc.).
          baseUrl: baseUrl ?? siteConfig.baseUrl,
          trailingSlash: siteConfig.trailingSlash,
          cacheDir: path.join(siteDir, "node_modules", ".cache", PLUGIN_NAME),
        }
      );
      for (const message of buildWarnings(result)) console.warn(`[${PLUGIN_NAME}] ${message}`);
      console.log(`[${PLUGIN_NAME}] Prepared ${result.posts} post(s) for cross-posting, with ${result.images} image(s).`);
    },
  };
}

/**
 * Names shared by the build steps and the theme components.
 * Runs both in Node and in the browser.
 */

/** The name Docusaurus knows this plugin by, used for its shared data. */
export const PLUGIN_NAME = "docusaurus-plugin-crosspost";

/** The name Docusaurus's blog plugin gives itself, whatever name or path
 * loaded it (PluginName in @docusaurus/plugin-content-blog). */
export const BLOG_PLUGIN_NAME = "docusaurus-plugin-content-blog";

/**
 * Networks Bridgy can publish to that this plugin supports, with each one's
 * Bridgy Publish address. Docs: https://brid.gy/about#publish
 */
export const BRIDGY_PUBLISH_TARGETS = {
  mastodon: "https://brid.gy/publish/mastodon",
  bluesky: "https://brid.gy/publish/bluesky",
};

/** The supported network names, e.g. for checking settings. */
export const NETWORKS = Object.keys(BRIDGY_PUBLISH_TARGETS);

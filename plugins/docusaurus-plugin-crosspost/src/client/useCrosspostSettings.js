/**
 * Gives the theme components the plugin's settings.
 *
 * The plugin shares its settings with the browser through Docusaurus's
 * global data (see contentLoaded in src/index.js).
 * Docs: https://docusaurus.io/docs/docusaurus-core#usePluginData
 */
import { usePluginData } from "@docusaurus/useGlobalData";
import { PLUGIN_NAME } from "../shared/names.js";

/**
 * Reads the plugin's settings in a React component.
 *
 * Returns:
 *     The settings shared by the plugin: networks, showResponses,
 *     tagsToHashtags and webmentionUsername, with defaults filled in.
 */
export default function useCrosspostSettings() {
  return usePluginData(PLUGIN_NAME);
}

import React from "react";
import LastUpdated from "@theme-original/LastUpdated";

/**
 * "Last updated on <date> by <name>" at the bottom of pages and posts.
 *
 * Docusaurus takes the name from whoever made the last git commit to the
 * file (the commit's author name; it doesn't read .mailmap). Commits made by
 * tools (Claude, GitHub's bots) or under Quinn's GitHub username would show
 * those names, so they are all shown as the site's author instead. Anyone
 * else's name is shown as it is.
 *
 * Swizzling (wrapping a Docusaurus component) docs:
 * https://docusaurus.io/docs/swizzling#wrapping
 */

const SITE_AUTHOR = "Quinn McHugh";

// Commit author names shown as SITE_AUTHOR.
const SITE_AUTHOR_ALIASES = ["Claude", "quinn-mchugh"];

function displayName(name) {
  if (!name) return name;
  const isAlias = SITE_AUTHOR_ALIASES.includes(name);
  const isBot = /\[bot\]$/.test(name); // e.g. github-actions[bot]
  return isAlias || isBot ? SITE_AUTHOR : name;
}

export default function LastUpdatedWrapper(props) {
  return <LastUpdated {...props} lastUpdatedBy={displayName(props.lastUpdatedBy)} />;
}

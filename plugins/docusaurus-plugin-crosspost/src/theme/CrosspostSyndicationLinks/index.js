/**
 * "Also on Mastodon, Bluesky" links to a post's cross-posted copies.
 *
 * The links come from the post's "syndication" front matter (saved by the
 * cross-posting workflow). They carry the "u-syndication" class, which is
 * how Bridgy matches replies on those networks back to the post.
 * Docs: https://indieweb.org/rel-syndication
 *
 * Styling: every part has a stable "crosspost-syndication..." class, and
 * colors come from CSS variables; see src/client/crosspost.css and the
 * README's "Styling the responses". To change the markup, swizzle it:
 * "npm run swizzle docusaurus-plugin-crosspost CrosspostSyndicationLinks".
 * Docs: https://docusaurus.io/docs/swizzling
 */
import React from "react";
import { networkName } from "../../components/SocialResponses/mentions.js";

/** Read by screen readers after links that open a new tab. */
export const NEW_TAB_NOTE = "(opens in a new tab)";

/**
 * "Also on" links to a post's copies on other networks.
 *
 * Args:
 *     props.urls: Safe addresses of the copies; may be empty.
 *     props.visible: False to keep the links only as hidden markup (the
 *         showSyndicationLinks setting). Bridgy reads hidden markup too,
 *         as it does the post's other hidden details.
 *
 * Returns:
 *     A paragraph of links, a hidden element with the links, or nothing if
 *     there are none.
 */
export default function CrosspostSyndicationLinks({ urls, visible = true }) {
  if (!urls.length) return null;
  if (!visible) {
    return (
      <div className="crosspost-syndication crosspost-syndication--hidden" hidden aria-hidden="true">
        {urls.map((url) => (
          <a key={url} className="u-syndication" href={url} rel="syndication" tabIndex={-1} />
        ))}
      </div>
    );
  }
  return (
    <p className="crosspost-syndication">
      <span className="crosspost-syndication__label">Also on </span>
      {urls.map((url, i) => {
        const network = networkName(url);
        return (
          <React.Fragment key={url}>
            {i > 0 && <span className="crosspost-syndication__separator">, </span>}
            <a
              className={`u-syndication crosspost-syndication__link crosspost-syndication__link--${network.toLowerCase()}`}
              href={url}
              rel="syndication noopener"
              target="_blank">
              {network}
              <span className="crosspost-visually-hidden"> {NEW_TAB_NOTE}</span>
            </a>
          </React.Fragment>
        );
      })}
    </p>
  );
}

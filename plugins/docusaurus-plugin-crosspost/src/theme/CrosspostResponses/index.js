/**
 * The responses to a blog post on Mastodon and Bluesky: likes, reposts and
 * replies, with buttons to reply on each network.
 *
 * Responses are fetched in the reader's browser from webmention.io, where
 * Bridgy delivers them, so new ones appear without rebuilding the site. If
 * webmention.io can't be reached, the section says so and the reply
 * buttons still show.
 *
 * Privacy: the reader's browser contacts webmention.io and loads avatars
 * from the responders' Mastodon and Bluesky servers.
 *
 * Safety: response text is shown as plain text, never as HTML, and every
 * link is checked to be a normal web address, because the data comes from
 * strangers (src/components/SocialResponses/mentions.js).
 *
 * Accessibility:
 * - A labelled <section> with its own heading, and a heading for each kind
 *   of response, so screen reader users can jump between them.
 * - Lists for avatars and replies; replies are an ordered list, oldest
 *   first. Each reply's date is a <time> element.
 * - Avatars in the likes and reposts rows are links named by the person's
 *   name (their alt text). A reply's avatar is decorative, since the name
 *   is next to it, so it isn't read twice or tabbed to twice.
 * - Links that open a new tab say so to screen readers.
 * - Loading and error messages are announced through a status region.
 * - Colors meet WCAG 2.2 AA contrast in light and dark mode; focus is
 *   always visible; targets are at least 24 by 24 pixels.
 *   Docs: https://www.w3.org/TR/WCAG22/
 *
 * Text is translatable with Docusaurus's i18n (ids "crosspost.responses.*").
 * Docs: https://docusaurus.io/docs/i18n/tutorial#translate-your-react-code
 *
 * Styling: every part has a stable "crosspost-..." class, and sizes and
 * colors come from CSS variables; see src/client/crosspost.css and the
 * README's "Styling the responses". To change the markup, swizzle it:
 * "npm run swizzle docusaurus-plugin-crosspost CrosspostResponses".
 * Docs: https://docusaurus.io/docs/swizzling
 */
import React, { useEffect, useId, useState } from "react";
import { translate } from "@docusaurus/Translate";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { usePluralForm } from "@docusaurus/theme-common";
import { formatDate, groupMentions, initialOf, mentionsApiUrl, networkName } from "../../components/SocialResponses/mentions.js";
import { NEW_TAB_NOTE } from "../CrosspostSyndicationLinks/index.js";

/** Link attributes for addresses written by other people. */
const EXTERNAL_LINK = { target: "_blank", rel: "nofollow ugc noopener noreferrer" };

/** Most avatars shown in a likes or reposts row; the rest are counted. */
export const MAX_FACES = 30;

/** The responses state before webmention.io has answered. */
const LOADING = { status: "loading", groups: null };

/**
 * Loads a page's responses from webmention.io.
 *
 * Starts again from "loading" when the page changes, so one post never
 * shows another post's responses while the new ones load.
 *
 * Args:
 *     pageUrl: The post's full address.
 *
 * Returns:
 *     { status, groups }: status is "loading", "ready" or "error"; groups is
 *     { likes, reposts, replies } once ready.
 */
function useResponses(pageUrl) {
  const [state, setState] = useState(LOADING);
  useEffect(() => {
    setState(LOADING);
    const controller = new AbortController();
    fetch(mentionsApiUrl(pageUrl), { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`webmention.io answered HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setState({ status: "ready", groups: groupMentions(data && data.children) }))
      .catch((error) => {
        if (error.name === "AbortError") return;
        console.warn("[CrosspostResponses] Could not load responses:", error.message);
        setState({ status: "error", groups: null });
      });
    return () => controller.abort();
  }, [pageUrl]);
  return state;
}

/**
 * Hidden text for screen readers, after a link that opens a new tab.
 *
 * Returns:
 *     A visually hidden span.
 */
function NewTabNote() {
  return (
    <span className="crosspost-visually-hidden">
      {" "}
      {translate({ id: "crosspost.responses.newTab", message: NEW_TAB_NOTE })}
    </span>
  );
}

/**
 * A person's picture, or their initial when they have none.
 *
 * Args:
 *     props.author: { name, url, photo } from authorOf.
 *     props.decorative: True when the name is shown next to it, so screen
 *         readers skip the picture.
 *
 * Returns:
 *     An <img>, or a <span> showing the initial.
 */
function Avatar({ author, decorative }) {
  if (author.photo) {
    return (
      <img
        className="crosspost-avatar"
        src={author.photo}
        alt={decorative ? "" : author.name}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    );
  }
  return decorative ? (
    <span className="crosspost-avatar crosspost-avatar--initial" aria-hidden="true">
      {initialOf(author.name)}
    </span>
  ) : (
    <span className="crosspost-avatar crosspost-avatar--initial" role="img" aria-label={author.name}>
      {initialOf(author.name)}
    </span>
  );
}

/**
 * The likes or reposts row: a heading with the count, and avatars.
 *
 * Args:
 *     props.kind: "likes" or "reposts" (also the CSS modifier).
 *     props.title: The heading text, e.g. "3 likes".
 *     props.entries: Responses of that kind.
 *
 * Returns:
 *     The row, or nothing if there are no entries.
 */
function Reactions({ kind, title, entries }) {
  const headingId = useId();
  if (!entries.length) return null;
  const shown = entries.slice(0, MAX_FACES);
  const hidden = entries.length - shown.length;
  return (
    <div className={`crosspost-reactions crosspost-reactions--${kind}`}>
      <h3 className="crosspost-reactions__title" id={headingId}>
        {title}
      </h3>
      <ul className="crosspost-reactions__faces" aria-labelledby={headingId}>
        {shown.map((entry) => (
          <li key={entry.id} className="crosspost-reactions__face">
            {entry.author.url ? (
              <a className="crosspost-reactions__link" href={entry.author.url} title={entry.author.name} {...EXTERNAL_LINK}>
                <Avatar author={entry.author} />
              </a>
            ) : (
              <span title={entry.author.name}>
                <Avatar author={entry.author} />
              </span>
            )}
          </li>
        ))}
        {hidden > 0 && (
          <li className="crosspost-reactions__more">
            {translate({ id: "crosspost.responses.more", message: "+{count} more" }, { count: hidden })}
          </li>
        )}
      </ul>
    </div>
  );
}

/**
 * One reply: avatar, name, network and date, then the text.
 *
 * Args:
 *     props.reply: A reply from groupMentions.
 *     props.locale: The site's current language, for the date.
 *
 * Returns:
 *     The reply as a list item.
 */
function Reply({ reply, locale }) {
  const date = formatDate(reply.published, locale);
  const network = reply.url ? networkName(reply.url) : "";
  const time = date && <time dateTime={reply.published}>{date}</time>;
  return (
    <li className={`crosspost-reply${network ? ` crosspost-reply--${network.toLowerCase()}` : ""}`}>
      <Avatar author={reply.author} decorative />
      <div className="crosspost-reply__body">
        <p className="crosspost-reply__header">
          {reply.author.url ? (
            <a className="crosspost-reply__author" href={reply.author.url} {...EXTERNAL_LINK}>
              {reply.author.name}
              <NewTabNote />
            </a>
          ) : (
            <span className="crosspost-reply__author">{reply.author.name}</span>
          )}
          {time && (
            <span className="crosspost-reply__meta">
              {reply.url ? (
                <a className="crosspost-reply__date" href={reply.url} {...EXTERNAL_LINK}>
                  {time}
                  {network && (
                    <span className="crosspost-reply__network">
                      {" "}
                      {translate({ id: "crosspost.responses.onNetwork", message: "on {network}" }, { network })}
                    </span>
                  )}
                  <NewTabNote />
                </a>
              ) : (
                <span className="crosspost-reply__date">{time}</span>
              )}
            </span>
          )}
        </p>
        <p className="crosspost-reply__text">{reply.text}</p>
      </div>
    </li>
  );
}

/**
 * Likes, reposts and replies for a post, with buttons to reply.
 *
 * Args:
 *     props.pageUrl: The post's full address.
 *     props.syndication: Safe addresses of the post's Mastodon and Bluesky
 *         copies; the reply buttons link to these.
 *
 * Returns:
 *     The responses section, or nothing when there are no copies to reply
 *     on and no responses.
 */
export default function CrosspostResponses({ pageUrl, syndication }) {
  const { status, groups } = useResponses(pageUrl);
  const { i18n } = useDocusaurusContext();
  const { selectMessage } = usePluralForm();
  const headingId = useId();
  const repliesHeadingId = useId();

  const counts = groups ? { likes: groups.likes.length, reposts: groups.reposts.length, replies: groups.replies.length } : null;
  const hasResponses = Boolean(counts) && counts.likes + counts.reposts + counts.replies > 0;
  if (!hasResponses && !syndication.length) return null;

  // usePluralForm picks the right form for the site's language from "one|other".
  // Docs: https://docusaurus.io/docs/i18n/tutorial#pluralization
  const plural = (id, forms, count) => selectMessage(count, translate({ id, message: forms }, { count }));

  let statusMessage = "";
  if (status === "loading") statusMessage = translate({ id: "crosspost.responses.loading", message: "Loading responses…" });
  if (status === "error") statusMessage = translate({ id: "crosspost.responses.error", message: "Responses couldn't be loaded right now." });
  if (status === "ready" && !hasResponses) statusMessage = translate({ id: "crosspost.responses.none", message: "No responses yet." });

  return (
    <section className="crosspost-responses" aria-labelledby={headingId}>
      <h2 className="crosspost-responses__heading" id={headingId}>
        {translate({ id: "crosspost.responses.heading", message: "Responses" })}
      </h2>

      {syndication.length > 0 && (
        <div className="crosspost-reply-buttons">
          {syndication.map((url) => {
            const network = networkName(url);
            return (
              <a
                key={url}
                className={`crosspost-reply-button crosspost-reply-button--${network.toLowerCase()}`}
                href={url}
                target="_blank"
                rel="noopener">
                {translate({ id: "crosspost.responses.replyOn", message: "Reply on {network}" }, { network })}
                <NewTabNote />
              </a>
            );
          })}
        </div>
      )}

      <p className="crosspost-responses__status" role="status">
        {statusMessage}
      </p>

      {hasResponses && (
        <>
          <Reactions kind="likes" title={plural("crosspost.responses.likes", "{count} like|{count} likes", counts.likes)} entries={groups.likes} />
          <Reactions kind="reposts" title={plural("crosspost.responses.reposts", "{count} repost|{count} reposts", counts.reposts)} entries={groups.reposts} />
          {counts.replies > 0 && (
            <div className="crosspost-replies">
              <h3 className="crosspost-replies__title" id={repliesHeadingId}>
                {plural("crosspost.responses.replies", "{count} reply|{count} replies", counts.replies)}
              </h3>
              <ol className="crosspost-replies__list" aria-labelledby={repliesHeadingId}>
                {groups.replies.map((reply) => (
                  <Reply key={reply.id} reply={reply} locale={i18n.currentLocale} />
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </section>
  );
}

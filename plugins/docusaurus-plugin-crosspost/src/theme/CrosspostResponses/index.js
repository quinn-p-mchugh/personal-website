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
 *   name (their alt text). A reply's avatar links to the same profile as
 *   the name next to it, so it is hidden from screen readers and skipped
 *   by the Tab key: the name is read, and tabbed to, once.
 * - "Show all" opens the full list in a native modal <dialog>, which keeps
 *   focus inside, closes with Esc, and returns focus to the button.
 *   Docs: https://developer.mozilla.org/docs/Web/HTML/Element/dialog
 * - Each reply's Reply and View links name the person for screen readers
 *   ("Reply to Quinn on Mastodon"), so a list of links still makes sense.
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
import React, { useEffect, useId, useRef, useState } from "react";
import { translate } from "@docusaurus/Translate";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { usePluralForm } from "@docusaurus/theme-common";
import { formatDate, groupMentions, handleOf, initialOf, mentionsApiUrl, networkName } from "../../components/SocialResponses/mentions.js";
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
 * A dialog listing everyone who liked or reposted: picture, name and
 * handle, each linked to their profile.
 *
 * Uses the browser's own modal <dialog> (showModal), which keeps keyboard
 * focus inside, closes with Esc, and puts focus back on the button that
 * opened it. The list is only built while the dialog is open, and the
 * pictures load as they scroll into view, so long lists stay quick.
 *
 * Args:
 *     props.title: The dialog's heading, e.g. "34 likes".
 *     props.entries: The responses to list.
 *     props.onClose: Called when the dialog closes.
 *
 * Returns:
 *     The dialog.
 */
function PeopleDialog({ title, entries, onClose }) {
  const dialogRef = useRef(null);
  const headingId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  const close = () => dialogRef.current && dialogRef.current.close();
  return (
    <dialog
      ref={dialogRef}
      className="crosspost-people-dialog"
      aria-labelledby={headingId}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> itself: close.
        if (event.target === dialogRef.current) close();
      }}>
      <div className="crosspost-people-dialog__header">
        <h2 className="crosspost-people-dialog__title" id={headingId}>
          {title}
        </h2>
        <button
          type="button"
          className="crosspost-people-dialog__close"
          onClick={close}
          aria-label={translate({ id: "crosspost.responses.close", message: "Close" })}>
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <ul className="crosspost-people-dialog__list">
        {entries.map((entry) => {
          const handle = handleOf(entry.author.url);
          const person = (
            <>
              <Avatar author={entry.author} decorative />
              <span className="crosspost-people-dialog__names">
                <span className="crosspost-people-dialog__name">{entry.author.name}</span>
                {handle && <span className="crosspost-people-dialog__handle">{handle}</span>}
              </span>
            </>
          );
          return (
            <li key={entry.id} className="crosspost-people-dialog__person">
              {entry.author.url ? (
                <a className="crosspost-people-dialog__link" href={entry.author.url} {...EXTERNAL_LINK}>
                  {person}
                  <NewTabNote />
                </a>
              ) : (
                <span className="crosspost-people-dialog__link">{person}</span>
              )}
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}

/**
 * The likes or reposts row: a heading with the count, avatars, and a
 * "Show all" button that lists everyone with their names.
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
  const [showingAll, setShowingAll] = useState(false);
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
          <li className="crosspost-reactions__more" aria-hidden="true">
            {translate({ id: "crosspost.responses.more", message: "+{count} more" }, { count: hidden })}
          </li>
        )}
      </ul>
      <button
        type="button"
        className="crosspost-reactions__show-all"
        aria-haspopup="dialog"
        onClick={() => setShowingAll(true)}>
        {translate({ id: "crosspost.responses.showAll", message: "Show all" })}
        <span className="crosspost-visually-hidden"> {title}</span>
      </button>
      {showingAll && <PeopleDialog title={title} entries={entries} onClose={() => setShowingAll(false)} />}
    </div>
  );
}

/**
 * One reply: avatar, name and handle, date, the text, then links to reply
 * to it and to view it on its network.
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
  const handle = handleOf(reply.author.url);
  const name = reply.author.name;
  return (
    <li className={`crosspost-reply${network ? ` crosspost-reply--${network.toLowerCase()}` : ""}`}>
      {reply.author.url ? (
        // Same destination as the name link: hidden from screen readers and
        // the Tab key, so each person is read and tabbed to once.
        <a className="crosspost-reply__avatar-link" href={reply.author.url} aria-hidden="true" tabIndex={-1} {...EXTERNAL_LINK}>
          <Avatar author={reply.author} decorative />
        </a>
      ) : (
        <Avatar author={reply.author} decorative />
      )}
      <div className="crosspost-reply__body">
        <p className="crosspost-reply__header">
          {reply.author.url ? (
            <a className="crosspost-reply__author" href={reply.author.url} {...EXTERNAL_LINK}>
              {name}
              <NewTabNote />
            </a>
          ) : (
            <span className="crosspost-reply__author">{name}</span>
          )}
          {handle && <span className="crosspost-reply__handle">{handle}</span>}
          {date && (
            <span className="crosspost-reply__date">
              <time dateTime={reply.published}>{date}</time>
            </span>
          )}
        </p>
        <p className="crosspost-reply__text">{reply.text}</p>
        {reply.url && (
          <p className="crosspost-reply__actions">
            {/* Replying happens on the reply's own page; there, Mastodon offers to
                continue on the reader's own server, and Bluesky has no link that
                opens a reply directly. */}
            <a className="crosspost-reply__action crosspost-reply__action--reply" href={reply.url} {...EXTERNAL_LINK}>
              {translate({ id: "crosspost.responses.replyToReply", message: "Reply" })}
              <span className="crosspost-visually-hidden">
                {" "}
                {translate({ id: "crosspost.responses.replyToReplyFull", message: "to {name} on {network}" }, { name, network })}
              </span>
              <NewTabNote />
            </a>
            <a className="crosspost-reply__action crosspost-reply__action--view" href={reply.url} {...EXTERNAL_LINK}>
              {translate({ id: "crosspost.responses.viewOn", message: "View on {network}" }, { network })}
              <span className="crosspost-visually-hidden">
                {" "}
                {translate({ id: "crosspost.responses.viewOnFull", message: "(reply from {name})" }, { name })}
              </span>
              <NewTabNote />
            </a>
          </p>
        )}
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

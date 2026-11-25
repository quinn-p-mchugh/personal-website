/**
 * The responses to a blog post on Mastodon and Bluesky: likes, reposts,
 * replies and Bluesky quotes, with buttons to reply on each network.
 *
 * Responses are fetched in the reader's browser from webmention.io, where
 * Bridgy delivers them, so new ones appear without rebuilding the site. If
 * webmention.io can't be reached, the section says so and the reply
 * buttons still show.
 *
 * Bluesky quotes come from Bluesky's public API (Bridgy doesn't send them);
 * Mastodon's quotes API needs a login, so Mastodon quotes can't be shown.
 *
 * Privacy: the reader's browser contacts webmention.io, Bluesky's public
 * API (for quotes, when the post has a Bluesky copy) and loads avatars from
 * the responders' Mastodon and Bluesky servers. Answers are reused for a few
 * minutes (src/shared/responseCache.js); no cookies are used.
 *
 * Safety: response text is shown as plain text, never as HTML, and every
 * link is checked to be a normal web address, because the data comes from
 * strangers (src/shared/responses.js).
 *
 * Accessibility:
 * - A labelled <section> with its own heading, and a heading for each kind
 *   of response, so screen reader users can jump between them.
 * - Lists for avatars and replies; replies are an ordered list, oldest
 *   first unless replyOrder is "newest". Each reply's date is a <time>
 *   element.
 * - Avatars in the likes and reposts rows are links named by the person's
 *   name (their alt text). A reply's avatar links to the same profile as
 *   the name next to it, so it is hidden from screen readers and skipped
 *   by the Tab key: the name is read, and tabbed to, once.
 * - A "+N more" button after the avatars ("+14 more, show all 34 likes" to
 *   screen readers)
 *   opens the full list in a native modal <dialog>, which keeps focus
 *   inside, closes with Esc, and returns focus to the button.
 *   Docs: https://developer.mozilla.org/docs/Web/HTML/Element/dialog
 * - Each reply's date links to the reply, and its "Reply on Mastodon" link
 *   names the person for screen readers ("Reply on Mastodon to Quinn"), so
 *   a list of links still makes sense.
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
import { responseCache } from "../../shared/responseCache.js";
import {
  blueskyPostRef,
  formatDate,
  groupMentions,
  handleOf,
  initialOf,
  mentionsApiUrl,
  networkName,
  quoteEntries,
  quotesApiUrl,
  resolveHandleUrl,
  withoutQuotes,
} from "../../shared/responses.js";
import { NEW_TAB_NOTE } from "../CrosspostSyndicationLinks/index.js";

/** Link attributes for addresses written by other people. */
const EXTERNAL_LINK = { target: "_blank", rel: "nofollow ugc noopener noreferrer" };

/** Settings used when the component is given none (e.g. when swizzled
 * and rendered on its own); the plugin passes its "responses" settings. */
const DEFAULT_SETTINGS = {
  showLikes: true,
  showReposts: true,
  showReplies: true,
  maxAvatarsShown: 20,
  maxRepliesShown: null,
  replyOrder: "oldest",
  showQuotes: true,
  showReplyButtons: true,
  headingLevel: 2,
  cacheMinutes: 5,
};

/**
 * Picks the heading elements for the section, so it fits the page's outline.
 *
 * Args:
 *     level: The section heading's level, 2 to 6 (the headingLevel setting).
 *
 * Returns:
 *     { Heading, Subheading }: e.g. "h2" and "h3"; the subheading is one
 *     level lower, at most h6.
 */
export function headingTags(level) {
  const safe = Math.min(Math.max(Number.parseInt(level, 10) || 2, 2), 6);
  return { Heading: `h${safe}`, Subheading: `h${Math.min(safe + 1, 6)}` };
}

/** The responses state before webmention.io has answered. */
const LOADING = { status: "loading", groups: null };

/**
 * Fetches JSON, failing on any answer that isn't 2xx.
 *
 * Args:
 *     url: The address.
 *     signal: An AbortSignal, to cancel when the page changes.
 *
 * Returns:
 *     A promise of the parsed JSON.
 */
async function fetchJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${new URL(url).host} answered HTTP ${res.status}`);
  return res.json();
}

/**
 * Loads the Bluesky posts quoting a post, from Bluesky's public API.
 *
 * Args:
 *     blueskyUrl: The post's Bluesky copy, e.g. "https://bsky.app/profile/me.bsky.social/post/3n34".
 *     signal: An AbortSignal.
 *
 * Returns:
 *     A promise of quote entries (quoteEntries), oldest first.
 */
async function loadQuotes(blueskyUrl, signal) {
  const ref = blueskyPostRef(blueskyUrl);
  if (!ref) return [];
  const did = ref.actor.startsWith("did:") ? ref.actor : (await fetchJson(resolveHandleUrl(ref.actor), signal)).did;
  if (typeof did !== "string" || !did.startsWith("did:")) return [];
  const data = await fetchJson(quotesApiUrl(did, ref.postId), signal);
  return quoteEntries(data && data.posts);
}

/**
 * Loads a page's responses: likes, reposts and replies from webmention.io,
 * and quotes from Bluesky. Each is kept for cacheMinutes (see
 * src/shared/responseCache.js), so going back to a post doesn't ask again.
 *
 * Starts again from "loading" when the page changes, so one post never
 * shows another post's responses while the new ones load. If quotes can't
 * be loaded, the rest still shows.
 *
 * Args:
 *     pageUrl: The post's full address.
 *     options.blueskyUrl: The post's Bluesky copy, or undefined (no quotes).
 *     options.cacheMinutes: How long answers are reused; 0 never reuses.
 *
 * Returns:
 *     { status, groups }: status is "loading", "ready" or "error"; groups is
 *     { likes, reposts, replies, quotes } once ready.
 */
function useResponses(pageUrl, { blueskyUrl, cacheMinutes }) {
  const [state, setState] = useState(LOADING);
  useEffect(() => {
    const cache = responseCache();
    const maxAgeMs = cacheMinutes * 60_000;
    const responsesKey = `responses:${pageUrl}`;
    const quotesKey = `quotes:${blueskyUrl}`;
    const cachedGroups = cache.get(responsesKey, maxAgeMs);
    const cachedQuotes = blueskyUrl ? cache.get(quotesKey, maxAgeMs) : [];
    const ready = (groups, quotes) =>
      setState({ status: "ready", groups: { ...groups, replies: withoutQuotes(groups.replies, quotes), quotes } });

    if (cachedGroups !== undefined && cachedQuotes !== undefined) {
      ready(cachedGroups, cachedQuotes);
      return undefined;
    }

    setState(LOADING);
    const controller = new AbortController();
    const groupsPromise =
      cachedGroups ??
      fetchJson(mentionsApiUrl(pageUrl), controller.signal).then((data) => {
        const groups = groupMentions(data && data.children);
        cache.set(responsesKey, groups);
        return groups;
      });
    const quotesPromise =
      cachedQuotes ??
      loadQuotes(blueskyUrl, controller.signal)
        .then((quotes) => {
          cache.set(quotesKey, quotes);
          return quotes;
        })
        .catch((error) => {
          if (error.name === "AbortError") throw error;
          console.warn("[CrosspostResponses] Could not load Bluesky quotes:", error.message);
          return [];
        });

    Promise.all([groupsPromise, quotesPromise])
      .then(([groups, quotes]) => ready(groups, quotes))
      .catch((error) => {
        if (error.name === "AbortError") return;
        console.warn("[CrosspostResponses] Could not load responses:", error.message);
        setState({ status: "error", groups: null });
      });
    return () => controller.abort();
  }, [pageUrl, blueskyUrl, cacheMinutes]);
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
 * The button that opens the full list of likes or reposts.
 *
 * Args:
 *     props.visible: Its visible text, e.g. "+14 more".
 *     props.title: The row's count, e.g. "34 likes", added for screen
 *         readers after the visible text ("+14 more, show all 34 likes"),
 *         so the visible words start its name (WCAG 2.5.3, label in name).
 *     props.onClick: Opens the list.
 *     props.countsOnly: True when no avatars are shown; then the name is
 *         "Show all 34 likes".
 *
 * Returns:
 *     The button.
 */
function ShowAllButton({ visible, title, onClick, countsOnly = false }) {
  return (
    <button type="button" className="crosspost-reactions__more" aria-haspopup="dialog" onClick={onClick}>
      {visible}
      <span className="crosspost-visually-hidden">
        {countsOnly
          ? ` ${title}`
          : translate({ id: "crosspost.responses.showAll", message: ", show all {title}" }, { title })}
      </span>
    </button>
  );
}

/**
 * The likes or reposts row: the count, up to maxAvatars avatars, and a
 * "+N more" button that lists everyone with their names when there are more.
 *
 * Args:
 *     props.kind: "likes" or "reposts" (also the CSS modifier).
 *     props.title: The heading text, e.g. "3 likes".
 *     props.entries: Responses of that kind.
 *     props.maxAvatars: Most avatars to show (the maxAvatarsShown setting);
 *         with 0, only the count and a "Show all" button.
 *     props.Subheading: The heading element for the count, e.g. "h3".
 *
 * Returns:
 *     The row, or nothing if there are no entries.
 */
function Reactions({ kind, title, entries, maxAvatars, Subheading = "h3" }) {
  const headingId = useId();
  const [showingAll, setShowingAll] = useState(false);
  if (!entries.length) return null;
  const shown = entries.slice(0, maxAvatars);
  const hidden = entries.length - shown.length;
  return (
    <div className={`crosspost-reactions crosspost-reactions--${kind}`}>
      <Subheading className="crosspost-reactions__title" id={headingId}>
        {title}
      </Subheading>
      {shown.length > 0 ? (
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
            <li className="crosspost-reactions__face">
              <ShowAllButton visible={translate({ id: "crosspost.responses.more", message: "+{count} more" }, { count: hidden })} title={title} onClick={() => setShowingAll(true)} />
            </li>
          )}
        </ul>
      ) : (
        // maxAvatarsShown: 0, counts only.
        <ShowAllButton
          visible={translate({ id: "crosspost.responses.showAllShort", message: "Show all" })}
          title={title}
          countsOnly
          onClick={() => setShowingAll(true)}
        />
      )}
      {showingAll && <PeopleDialog title={title} entries={entries} onClose={() => setShowingAll(false)} />}
    </div>
  );
}

/**
 * One reply: avatar, name and date (linked to the reply), the text, and a
 * link to reply to it on its network.
 *
 * Args:
 *     props.reply: A reply from groupMentions.
 *     props.locale: The site's current language, for the date.
 *     props.focusRef: A ref to receive focus, for the first reply revealed
 *         by "Show N more replies"; usually undefined.
 *
 * Returns:
 *     The reply as a list item.
 */
function Reply({ reply, locale, focusRef }) {
  const date = formatDate(reply.published, locale);
  const network = reply.url ? networkName(reply.url) : "";
  const name = reply.author.name;
  return (
    // tabIndex -1: focusable from code only, for "Show N more replies".
    <li
      className={`crosspost-reply${network ? ` crosspost-reply--${network.toLowerCase()}` : ""}`}
      ref={focusRef}
      tabIndex={focusRef ? -1 : undefined}>
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
          {date && (
            // No separator character: the smaller, muted date reads as separate,
            // and nothing is left dangling when a long name wraps.
            <span className="crosspost-reply__when">
              {/* The date is the reply's own link, as on Mastodon and Bluesky. */}
              {reply.url ? (
                <a className="crosspost-reply__date" href={reply.url} {...EXTERNAL_LINK}>
                  <time dateTime={reply.published}>{date}</time>
                  <span className="crosspost-visually-hidden">
                    {" "}
                    {translate({ id: "crosspost.responses.dateLink", message: "(view the reply on {network})" }, { network })}
                  </span>
                  <NewTabNote />
                </a>
              ) : (
                <time className="crosspost-reply__date" dateTime={reply.published}>
                  {date}
                </time>
              )}
            </span>
          )}
        </p>
        <p className="crosspost-reply__text">{reply.text}</p>
        {reply.url && (
          // Replying happens on the reply's own page: there, Mastodon offers to
          // continue on the reader's own server, and Bluesky has no link that
          // opens a reply directly.
          <a className="crosspost-reply__action" href={reply.url} {...EXTERNAL_LINK}>
            {translate({ id: "crosspost.responses.replyOnNetwork", message: "Reply on {network}" }, { network })}
            <span className="crosspost-visually-hidden">
              {" "}
              {translate({ id: "crosspost.responses.replyToWhom", message: "to {name}" }, { name })}
            </span>
            <NewTabNote />
          </a>
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
 *     props.settings: The plugin's "responses" settings (showLikes,
 *         showReposts, showReplies, maxAvatarsShown, maxRepliesShown,
 *         replyOrder, showQuotes, showReplyButtons, headingLevel,
 *         cacheMinutes);
 *         missing ones use DEFAULT_SETTINGS.
 *
 * Returns:
 *     The responses section, or nothing when there are no copies to reply
 *     on and no responses.
 */
export default function CrosspostResponses({ pageUrl, syndication, settings: given }) {
  const settings = { ...DEFAULT_SETTINGS, ...given };
  const { Heading, Subheading } = headingTags(settings.headingLevel);
  const blueskyUrl = settings.showQuotes ? syndication.find((url) => blueskyPostRef(url)) : undefined;
  const { status, groups } = useResponses(pageUrl, { blueskyUrl, cacheMinutes: settings.cacheMinutes });
  const [showingAllReplies, setShowingAllReplies] = useState(false);
  const firstNewReplyRef = useRef(null);
  const { i18n } = useDocusaurusContext();
  const { selectMessage } = usePluralForm();
  const headingId = useId();
  const repliesHeadingId = useId();
  const quotesHeadingId = useId();

  // Hidden kinds count as none, so "No responses yet" stays accurate.
  const counts = groups
    ? {
        likes: settings.showLikes ? groups.likes.length : 0,
        reposts: settings.showReposts ? groups.reposts.length : 0,
        replies: settings.showReplies ? groups.replies.length : 0,
        quotes: settings.showQuotes ? groups.quotes.length : 0,
      }
    : null;
  const replyLimit = settings.maxRepliesShown;
  // webmention.io returns them oldest first (mentionsApiUrl asks for that).
  const inOrder = (entries) => (settings.replyOrder === "newest" ? [...entries].reverse() : entries);
  const orderedReplies = groups ? inOrder(groups.replies) : [];
  const orderedQuotes = groups ? inOrder(groups.quotes) : [];
  const shownReplies = replyLimit != null && !showingAllReplies ? orderedReplies.slice(0, replyLimit) : orderedReplies;
  const hiddenReplies = counts && counts.replies ? counts.replies - shownReplies.length : 0;

  // After "Show N more replies", move focus to the first reply it revealed,
  // so keyboard and screen reader users continue where the button was.
  useEffect(() => {
    if (showingAllReplies && firstNewReplyRef.current) firstNewReplyRef.current.focus();
  }, [showingAllReplies]);
  const hasResponses = Boolean(counts) && counts.likes + counts.reposts + counts.replies + counts.quotes > 0;
  if (!hasResponses && !(settings.showReplyButtons && syndication.length)) return null;

  // usePluralForm picks the right form for the site's language from "one|other".
  // Docs: https://docusaurus.io/docs/i18n/tutorial#pluralization
  const plural = (id, forms, count) => selectMessage(count, translate({ id, message: forms }, { count }));

  let statusMessage = "";
  if (status === "loading") statusMessage = translate({ id: "crosspost.responses.loading", message: "Loading responses…" });
  if (status === "error") statusMessage = translate({ id: "crosspost.responses.error", message: "Responses couldn't be loaded right now." });
  if (status === "ready" && !hasResponses) statusMessage = translate({ id: "crosspost.responses.none", message: "No responses yet." });

  return (
    <section className="crosspost-responses" aria-labelledby={headingId}>
      <Heading className="crosspost-responses__heading" id={headingId}>
        {translate({ id: "crosspost.responses.heading", message: "Responses" })}
      </Heading>

      {settings.showReplyButtons && syndication.length > 0 && (
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
          {counts.likes + counts.reposts > 0 && (
            <div className="crosspost-responses__reactions">
              {settings.showLikes && (
                <Reactions
                  kind="likes"
                  title={plural("crosspost.responses.likes", "{count} like|{count} likes", counts.likes)}
                  entries={groups.likes}
                  maxAvatars={settings.maxAvatarsShown}
                  Subheading={Subheading}
                />
              )}
              {settings.showReposts && (
                <Reactions
                  kind="reposts"
                  title={plural("crosspost.responses.reposts", "{count} repost|{count} reposts", counts.reposts)}
                  entries={groups.reposts}
                  maxAvatars={settings.maxAvatarsShown}
                  Subheading={Subheading}
                />
              )}
            </div>
          )}
          {counts.replies > 0 && (
            <div className="crosspost-replies">
              <Subheading className="crosspost-replies__title" id={repliesHeadingId}>
                {plural("crosspost.responses.replies", "{count} reply|{count} replies", counts.replies)}
              </Subheading>
              <ol className="crosspost-replies__list" aria-labelledby={repliesHeadingId}>
                {shownReplies.map((reply, i) => (
                  <Reply
                    key={reply.id}
                    reply={reply}
                    locale={i18n.currentLocale}
                    focusRef={showingAllReplies && replyLimit != null && i === replyLimit ? firstNewReplyRef : undefined}
                  />
                ))}
              </ol>
              {hiddenReplies > 0 && (
                <button type="button" className="crosspost-replies__more" onClick={() => setShowingAllReplies(true)}>
                  {plural("crosspost.responses.moreReplies", "Show {count} more reply|Show {count} more replies", hiddenReplies)}
                </button>
              )}
            </div>
          )}
          {counts.quotes > 0 && (
            <div className="crosspost-quotes">
              <Subheading className="crosspost-quotes__title" id={quotesHeadingId}>
                {plural("crosspost.responses.quotes", "{count} quote|{count} quotes", counts.quotes)}
              </Subheading>
              <ol className="crosspost-quotes__list" aria-labelledby={quotesHeadingId}>
                {orderedQuotes.map((quote) => (
                  <Reply key={quote.id} reply={quote} locale={i18n.currentLocale} />
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </section>
  );
}

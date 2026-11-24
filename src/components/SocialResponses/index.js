/**
 * Shows a blog post's Mastodon and Bluesky copies and the responses to them.
 *
 * Two parts:
 * - SyndicationLinks: "Also on Mastodon · Bluesky" links, from the post's
 *   "syndication" front matter (saved by the cross-posting GitHub Action).
 *   They carry the "u-syndication" class, which is how Bridgy matches
 *   replies on those networks back to this post.
 *   Docs: https://indieweb.org/rel-syndication
 * - SocialResponses: likes, reposts and replies, fetched in the reader's
 *   browser from webmention.io, where Bridgy delivers them. New responses
 *   appear without rebuilding the site. If webmention.io can't be reached,
 *   only the reply buttons show.
 *
 * Privacy: the reader's browser contacts webmention.io and loads avatars
 * from the responders' Mastodon and Bluesky servers.
 *
 * Response text is shown as plain text, never as HTML, and every link is
 * checked to be a normal web address, because the data comes from strangers.
 */
import React, { useEffect, useState } from "react";
import styles from "./styles.module.css";
import { formatDate, groupMentions, mentionsApiUrl, networkName } from "./mentions.mjs";

/** Link attributes for addresses written by other people. */
const EXTERNAL_LINK = { target: "_blank", rel: "nofollow ugc noopener noreferrer" };

/**
 * "Also on Mastodon · Bluesky" links to a post's cross-posted copies.
 *
 * Args:
 *     props.urls: Safe addresses of the copies; may be empty.
 *
 * Returns:
 *     A paragraph of u-syndication links, or nothing if there are none.
 */
export function SyndicationLinks({ urls }) {
  if (!urls.length) return null;
  return (
    <p className={styles.syndication}>
      Also on{" "}
      {urls.map((url, i) => (
        <React.Fragment key={url}>
          {i > 0 && " · "}
          <a className="u-syndication" href={url} rel="syndication noopener" target="_blank">
            {networkName(url)}
          </a>
        </React.Fragment>
      ))}
    </p>
  );
}

/**
 * Loads a page's responses from webmention.io.
 *
 * Args:
 *     pageUrl: The post's full address.
 *
 * Returns:
 *     { status, groups }: status is "loading", "ready" or "error"; groups is
 *     { likes, reposts, replies } once ready.
 */
function useResponses(pageUrl) {
  const [state, setState] = useState({ status: "loading", groups: null });
  useEffect(() => {
    const controller = new AbortController();
    fetch(mentionsApiUrl(pageUrl), { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`webmention.io answered HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setState({ status: "ready", groups: groupMentions(data && data.children) }))
      .catch((error) => {
        if (error.name === "AbortError") return;
        console.warn("[SocialResponses] Could not load responses:", error.message);
        setState({ status: "error", groups: null });
      });
    return () => controller.abort();
  }, [pageUrl]);
  return state;
}

/**
 * A person's avatar, linked to their profile when there is one.
 *
 * Args:
 *     props.author: { name, url, photo } from authorOf.
 *     props.size: Avatar size in pixels.
 *
 * Returns:
 *     The avatar, or the person's initial when they have no photo.
 */
function Avatar({ author, size }) {
  const face = author.photo ? (
    <img
      className={styles.avatar}
      src={author.photo}
      alt={author.name}
      title={author.name}
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  ) : (
    <span className={styles.avatarFallback} title={author.name} style={{ width: size, height: size }}>
      {author.name.slice(0, 1).toUpperCase()}
    </span>
  );
  return author.url ? (
    <a href={author.url} {...EXTERNAL_LINK} aria-label={author.name}>
      {face}
    </a>
  ) : (
    face
  );
}

/**
 * A row of avatars for likes or reposts.
 *
 * Args:
 *     props.label: "Like" or "Repost".
 *     props.entries: Responses of that kind.
 *
 * Returns:
 *     The labelled row, or nothing if there are no entries.
 */
function Facepile({ label, entries }) {
  if (!entries.length) return null;
  return (
    <div className={styles.facepile}>
      <span className={styles.facepileLabel}>
        {entries.length} {label}
        {entries.length === 1 ? "" : "s"}
      </span>
      <ul className={styles.faces}>
        {entries.map((entry) => (
          <li key={entry.id}>
            <Avatar author={entry.author} size={32} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One reply: avatar, name, date and text.
 *
 * Args:
 *     props.reply: A reply from groupMentions.
 *
 * Returns:
 *     The reply as a list item.
 */
function Reply({ reply }) {
  const date = formatDate(reply.published);
  return (
    <li className={styles.reply}>
      <Avatar author={reply.author} size={40} />
      <div className={styles.replyBody}>
        <p className={styles.replyMeta}>
          {reply.author.url ? (
            <a href={reply.author.url} {...EXTERNAL_LINK}>
              {reply.author.name}
            </a>
          ) : (
            reply.author.name
          )}
          {date && (
            <>
              {" · "}
              {reply.url ? (
                <a href={reply.url} {...EXTERNAL_LINK}>
                  {date}
                </a>
              ) : (
                date
              )}
            </>
          )}
        </p>
        <p className={styles.replyText}>{reply.text}</p>
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
 *     The responses section, or nothing when there are no responses and no
 *     copies to reply on.
 */
export default function SocialResponses({ pageUrl, syndication }) {
  const { status, groups } = useResponses(pageUrl);
  const hasResponses =
    status === "ready" && (groups.likes.length || groups.reposts.length || groups.replies.length);
  if (!hasResponses && !syndication.length) return null;

  return (
    <section className={styles.responses} aria-labelledby="social-responses-heading">
      <h2 id="social-responses-heading" className={styles.heading}>
        Responses
      </h2>
      {hasResponses ? (
        <>
          <Facepile label="Like" entries={groups.likes} />
          <Facepile label="Repost" entries={groups.reposts} />
          {groups.replies.length > 0 && (
            <ul className={styles.replies}>
              {groups.replies.map((reply) => (
                <Reply key={reply.id} reply={reply} />
              ))}
            </ul>
          )}
        </>
      ) : (
        // Only claim "none" when webmention.io answered; on an error, say nothing.
        status === "ready" && <p className={styles.empty}>No responses yet.</p>
      )}
      {syndication.length > 0 && (
        <p className={styles.replyButtons}>
          {syndication.map((url) => (
            <a key={url} className="button button--secondary button--sm" href={url} target="_blank" rel="noopener">
              Reply on {networkName(url)}
            </a>
          ))}
        </p>
      )}
    </section>
  );
}

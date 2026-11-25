/**
 * Pure helpers for showing Mastodon and Bluesky responses on blog posts.
 *
 * How responses get here: Bridgy watches the Mastodon and Bluesky copies of
 * each post and sends every reply, like and repost to webmention.io as a
 * webmention. webmention.io stores them, and its public API returns them per
 * page as JSON (jf2). These helpers build that API request and sort what
 * comes back. They have no React or browser code, so they can be tested with
 * plain Node.
 * Docs: https://brid.gy/about and https://github.com/aaronpk/webmention.io
 * Tests: test/responses.test.js
 */

/** webmention.io's public API for one page's responses. Docs: README above. */
export const WEBMENTION_API = "https://webmention.io/api/mentions.jf2";

/** Most responses fetched per page; webmention.io allows up to 1000. */
export const MAX_RESPONSES = 500;

/**
 * Returns a URL only if it is a normal web address.
 *
 * Response data comes from other people, so every link is checked before it
 * goes into an href: a "javascript:" address could run code on the site.
 *
 * Args:
 *     url: Any value.
 *
 * Returns:
 *     The URL if it starts with http:// or https://, otherwise null.
 */
export function safeUrl(url) {
  if (typeof url !== "string") return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/**
 * Names the network a cross-posted copy lives on.
 *
 * Args:
 *     url: Address of a Mastodon or Bluesky post.
 *
 * Returns:
 *     "Bluesky" for bsky.app addresses, otherwise "Mastodon".
 */
export function networkName(url) {
  const safe = safeUrl(url);
  const host = safe ? new URL(safe).hostname : "";
  return host === "bsky.app" || host.endsWith(".bsky.app") ? "Bluesky" : "Mastodon";
}

/**
 * Cleans a post's "syndication" front matter into a list of web addresses.
 *
 * Args:
 *     value: The front matter value: a list, a single string, or missing.
 *
 * Returns:
 *     Unique, safe web addresses, in their original order.
 */
export function syndicationUrls(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(list.map(safeUrl).filter(Boolean))];
}

/**
 * Lists the addresses a response to a page might name.
 *
 * Bridgy sends a response to the address a post's page ends up at, after
 * following redirects, so a host that redirects "example.com" to
 * "www.example.com" (or back) makes responses name the other host. A
 * response may also name the address with or without a trailing slash.
 *
 * Args:
 *     pageUrl: The post's full address.
 *
 * Returns:
 *     The address with and without "www." and a trailing slash; the
 *     address as given comes first.
 */
export function addressVariants(pageUrl) {
  const url = new URL(pageUrl);
  const otherHost = url.hostname.startsWith("www.") ? url.hostname.slice(4) : `www.${url.hostname}`;
  const variants = [];
  for (const hostname of [url.hostname, otherHost]) {
    const copy = new URL(url.href);
    copy.hostname = hostname;
    const bare = copy.href.replace(/\/+$/, "");
    variants.push(bare, `${bare}/`);
  }
  const given = url.href;
  return [given, ...new Set(variants.filter((variant) => variant !== given))];
}

/**
 * Builds the webmention.io request for one page's responses.
 *
 * Asks for every address a response might name (see addressVariants).
 *
 * Args:
 *     pageUrl: The post's full address.
 *
 * Returns:
 *     The API URL, oldest responses first.
 */
export function mentionsApiUrl(pageUrl) {
  const params = new URLSearchParams();
  for (const target of addressVariants(pageUrl)) params.append("target[]", target);
  params.set("per-page", String(MAX_RESPONSES));
  params.set("sort-by", "published");
  params.set("sort-dir", "up");
  return `${WEBMENTION_API}?${params}`;
}

/**
 * Picks the parts of a response's author that are safe to show.
 *
 * Args:
 *     author: The jf2 "author" object, possibly missing.
 *
 * Returns:
 *     { name, url, photo }: name falls back to the profile address or
 *     "Someone"; url and photo are safe web addresses or null.
 */
export function authorOf(author) {
  const a = author && typeof author === "object" ? author : {};
  const url = safeUrl(a.url);
  const name = (typeof a.name === "string" && a.name.trim()) || url || "Someone";
  return { name, url, photo: safeUrl(a.photo) };
}

/**
 * Works out a person's handle from their profile address, to show under
 * their name. webmention.io doesn't send handles, but the profile address
 * holds one on both networks.
 *
 * Args:
 *     profileUrl: A profile address, e.g. "https://mastodon.social/@quinn"
 *         or "https://bsky.app/profile/quinn.bsky.social"; may be null.
 *
 * Returns:
 *     "@quinn@mastodon.social" or "@quinn.bsky.social"; for other
 *     addresses, the host and path (e.g. "example.com/me"); "" if none.
 */
export function handleOf(profileUrl) {
  const safe = safeUrl(profileUrl);
  if (!safe) return "";
  const url = new URL(safe);
  const parts = url.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  if ((url.hostname === "bsky.app" || url.hostname.endsWith(".bsky.app")) && parts[0] === "profile" && parts[1]) {
    return `@${parts[1]}`;
  }
  // Mastodon and most other fediverse servers: https://server/@user
  if (parts.length === 1 && /^@[^@]+$/.test(parts[0])) return `${parts[0]}@${url.hostname}`;
  return `${url.hostname}${url.pathname.replace(/\/$/, "")}`;
}

/**
 * Gets the value that identifies a response, for spotting repeats.
 *
 * Args:
 *     item: One jf2 response.
 *
 * Returns:
 *     The response's own address, else its source page, else its
 *     webmention.io id, as a string; "" if it has none of these.
 */
export function responseKey(item) {
  const key = item.url || item["wm-source"] || item["wm-id"];
  return key ? String(key) : "";
}

/**
 * Picks the parts of a response that are safe to show.
 *
 * Args:
 *     item: One jf2 response.
 *     key: Its value from responseKey.
 *
 * Returns:
 *     { id, url, author, text, published }: url is a safe web address or
 *     null; text is plain text, possibly ""; published is a date string,
 *     possibly "".
 */
export function responseEntry(item, key) {
  const text = item.content && typeof item.content.text === "string" ? item.content.text.trim() : "";
  const published = [item.published, item["wm-received"]].find((date) => typeof date === "string");
  return {
    id: String(item["wm-id"] || key),
    url: safeUrl(item.url) || safeUrl(item["wm-source"]),
    author: authorOf(item.author),
    text,
    published: published || "",
  };
}

/**
 * Names the group a response belongs in.
 *
 * Args:
 *     item: One jf2 response.
 *     entry: Its entry from responseEntry.
 *
 * Returns:
 *     "likes", "reposts" or "replies"; null for kinds that aren't shown,
 *     such as bookmarks or mentions without text.
 */
export function responseGroup(item, entry) {
  const property = item["wm-property"];
  if (property === "like-of") return "likes";
  if (property === "repost-of") return "reposts";
  if ((property === "in-reply-to" || property === "mention-of") && entry.text) return "replies";
  return null;
}

/**
 * Sorts webmention.io responses into likes, reposts and replies.
 *
 * Private responses are left out. Bridgy can send the same response more
 * than once, so repeats (same address) are removed. A mention counts as a
 * reply only if it has text.
 *
 * Args:
 *     children: The "children" list from a jf2 response.
 *
 * Returns:
 *     { likes, reposts, replies }, each a list of entries from
 *     responseEntry, in the order received.
 */
export function groupMentions(children) {
  const groups = { likes: [], reposts: [], replies: [] };
  const seen = new Set();
  for (const item of Array.isArray(children) ? children : []) {
    if (!item || typeof item !== "object" || item["wm-private"]) continue;
    const key = responseKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const entry = responseEntry(item, key);
    const group = responseGroup(item, entry);
    if (group) groups[group].push(entry);
  }
  return groups;
}

/**
 * Gets the first character of a name, for an avatar placeholder.
 *
 * Args:
 *     name: A person's name; never empty (authorOf guarantees it).
 *
 * Returns:
 *     The first character in capitals. Works for emoji and other characters
 *     that take two code units, which a plain name[0] would cut in half.
 */
export function initialOf(name) {
  return (Array.from(name)[0] || "?").toUpperCase();
}

/**
 * Formats a response date for display, in the site's language.
 *
 * Args:
 *     iso: An ISO 8601 date string, possibly empty.
 *     locale: A BCP 47 language tag, e.g. the site's current locale
 *         ("en" by default).
 *
 * Returns:
 *     The date, e.g. "Nov 24, 2026" in English; "" if missing or invalid.
 */
export function formatDate(iso, locale = "en") {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return "";
  try {
    return date.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    // An unknown language tag: fall back to English.
    return date.toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
  }
}

/*
 * Bluesky quote posts.
 *
 * Bridgy doesn't send quotes to webmention.io, so they're read straight
 * from Bluesky's public API, which needs no login:
 * app.bsky.feed.getQuotes lists the posts quoting a post. It takes the
 * post's AT-URI ("at://<did>/app.bsky.feed.post/<id>"), so a post address
 * holding a handle first needs com.atproto.identity.resolveHandle.
 * Docs: https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/feed/getQuotes.json
 * Mastodon has a quotes API too, but it requires a logged-in user, so
 * Mastodon quotes can't be shown.
 * Docs: https://docs.joinmastodon.org/client/quotes/
 */

/** Bluesky's public API, for requests that need no login. */
export const BLUESKY_PUBLIC_API = "https://public.api.bsky.app/xrpc";

/** Most quotes asked for (getQuotes allows up to 100 per request). */
export const MAX_QUOTES = 100;

/**
 * Reads the account and post id from a Bluesky post address.
 *
 * Args:
 *     url: e.g. "https://bsky.app/profile/me.bsky.social/post/3n34ewtyb6n2g".
 *
 * Returns:
 *     { actor, postId }: actor is a handle or a DID; null for other
 *     addresses.
 */
export function blueskyPostRef(url) {
  const safe = safeUrl(url);
  if (!safe) return null;
  const parsed = new URL(safe);
  if (parsed.hostname !== "bsky.app" && !parsed.hostname.endsWith(".bsky.app")) return null;
  const [profile, actor, post, postId] = parsed.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  if (profile !== "profile" || post !== "post" || !actor || !postId) return null;
  return { actor, postId };
}

/**
 * Builds the request that turns a Bluesky handle into its DID.
 *
 * Args:
 *     handle: e.g. "me.bsky.social".
 *
 * Returns:
 *     The API URL.
 */
export function resolveHandleUrl(handle) {
  return `${BLUESKY_PUBLIC_API}/com.atproto.identity.resolveHandle?${new URLSearchParams({ handle })}`;
}

/**
 * Builds the request for the posts quoting a Bluesky post.
 *
 * Args:
 *     did: The post author's DID, e.g. "did:plc:abc".
 *     postId: The post's id (the last part of its address).
 *
 * Returns:
 *     The API URL.
 */
export function quotesApiUrl(did, postId) {
  const uri = `at://${did}/app.bsky.feed.post/${postId}`;
  return `${BLUESKY_PUBLIC_API}/app.bsky.feed.getQuotes?${new URLSearchParams({ uri, limit: String(MAX_QUOTES) })}`;
}

/**
 * Turns getQuotes' posts into entries shaped like replies (responseEntry).
 *
 * Args:
 *     posts: The "posts" list from app.bsky.feed.getQuotes; may be missing.
 *
 * Returns:
 *     { id, url, author, text, published } for each quote, oldest first;
 *     url is the quote's bsky.app address.
 */
export function quoteEntries(posts) {
  const entries = [];
  for (const post of Array.isArray(posts) ? posts : []) {
    if (!post || typeof post !== "object" || !post.author || typeof post.uri !== "string") continue;
    const postId = post.uri.split("/").pop();
    const handle = typeof post.author.handle === "string" ? post.author.handle : post.author.did;
    if (!postId || !handle) continue;
    const profileUrl = `https://bsky.app/profile/${encodeURIComponent(handle)}`;
    const record = post.record && typeof post.record === "object" ? post.record : {};
    entries.push({
      id: post.uri,
      url: `${profileUrl}/post/${encodeURIComponent(postId)}`,
      author: authorOf({ name: post.author.displayName || `@${handle}`, url: profileUrl, photo: post.author.avatar }),
      text: typeof record.text === "string" ? record.text.trim() : "",
      published: [record.createdAt, post.indexedAt].find((date) => typeof date === "string") || "",
    });
  }
  return entries.sort((a, b) => String(a.published).localeCompare(String(b.published)));
}

/**
 * Leaves out replies that are really quotes, so nothing shows twice if a
 * quote also reached webmention.io as a mention.
 *
 * Args:
 *     replies: Replies from groupMentions.
 *     quotes: Entries from quoteEntries.
 *
 * Returns:
 *     The replies whose Bluesky post id isn't one of the quotes'.
 */
export function withoutQuotes(replies, quotes) {
  const quoteIds = new Set(quotes.map((quote) => (blueskyPostRef(quote.url) || {}).postId).filter(Boolean));
  if (!quoteIds.size) return replies;
  return replies.filter((reply) => !quoteIds.has((blueskyPostRef(reply.url) || {}).postId));
}

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
 * Builds the webmention.io request for one page's responses.
 *
 * Asks for the address with and without a trailing slash, since a response
 * may name either form.
 *
 * Args:
 *     pageUrl: The post's full address.
 *
 * Returns:
 *     The API URL, oldest responses first.
 */
export function mentionsApiUrl(pageUrl) {
  const bare = pageUrl.replace(/\/+$/, "");
  const params = new URLSearchParams();
  params.append("target[]", bare);
  params.append("target[]", `${bare}/`);
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
 *     { likes, reposts, replies }, each a list of
 *     { id, url, author, text, published }.
 */
export function groupMentions(children) {
  const groups = { likes: [], reposts: [], replies: [] };
  const seen = new Set();
  for (const item of Array.isArray(children) ? children : []) {
    if (!item || item["wm-private"]) continue;
    const key = item.url || item["wm-source"] || item["wm-id"];
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const text = item.content && typeof item.content.text === "string" ? item.content.text.trim() : "";
    const entry = {
      id: String(item["wm-id"] || key),
      url: safeUrl(item.url) || safeUrl(item["wm-source"]),
      author: authorOf(item.author),
      text,
      published: typeof item.published === "string" ? item.published : item["wm-received"] || "",
    };
    const property = item["wm-property"];
    if (property === "like-of") groups.likes.push(entry);
    else if (property === "repost-of") groups.reposts.push(entry);
    else if ((property === "in-reply-to" || property === "mention-of") && text) groups.replies.push(entry);
  }
  return groups;
}

/**
 * Formats a response date for display.
 *
 * Args:
 *     iso: An ISO 8601 date string, possibly empty.
 *
 * Returns:
 *     A date like "Nov 24, 2026", or "" if the value isn't a valid date.
 */
export function formatDate(iso) {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

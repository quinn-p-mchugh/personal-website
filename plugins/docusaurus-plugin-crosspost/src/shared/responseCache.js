/**
 * A short-lived cache for responses, so revisiting a post (or going back
 * to it) doesn't ask webmention.io and Bluesky again for a few minutes.
 *
 * Where it keeps them:
 * - sessionStorage, when the browser allows it. It holds data for this
 *   tab only and is cleared when the tab closes; it isn't a cookie and is
 *   never sent to any server.
 *   Docs: https://developer.mozilla.org/docs/Web/API/Window/sessionStorage
 * - Otherwise, plain memory. Browsers that block cookies usually block
 *   storage too, and then reading sessionStorage throws an error. Those
 *   readers still get the cache while they move between pages of the site
 *   (Docusaurus pages change without reloading), and nothing is stored.
 *
 * Runs in the browser and in Node (for tests): storage and the clock are
 * passed in.
 * Tests: test/responseCache.test.js
 */

/** Prefix for this plugin's sessionStorage keys. */
export const CACHE_KEY_PREFIX = "docusaurus-plugin-crosspost:";

/**
 * Finds the browser's sessionStorage, if it may be used.
 *
 * Returns:
 *     sessionStorage, or null when there is none (during the build) or the
 *     browser blocks it (for example, when cookies are blocked).
 */
export function availableSessionStorage() {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    // Some browsers only refuse on use, so try a write.
    const probe = `${CACHE_KEY_PREFIX}probe`;
    window.sessionStorage.setItem(probe, "1");
    window.sessionStorage.removeItem(probe);
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Creates a cache.
 *
 * Args:
 *     options.storage: A Storage (getItem, setItem) to use, or null for
 *         memory only.
 *     options.now: Returns the current time in milliseconds.
 *
 * Returns:
 *     { get(key, maxAgeMs), set(key, value) }: get gives the value saved
 *     under key if it is younger than maxAgeMs, else undefined; set saves a
 *     JSON-safe value. Neither ever throws: when storage fails (full or
 *     blocked), memory is used.
 */
export function createCache({ storage = null, now = Date.now } = {}) {
  const memory = new Map();

  return {
    get(key, maxAgeMs) {
      if (!(maxAgeMs > 0)) return undefined;
      let entry = memory.get(key);
      if (!entry && storage) {
        try {
          const saved = storage.getItem(CACHE_KEY_PREFIX + key);
          entry = saved ? JSON.parse(saved) : undefined;
        } catch {
          entry = undefined;
        }
      }
      if (!entry || typeof entry.savedAt !== "number" || now() - entry.savedAt > maxAgeMs) return undefined;
      return entry.value;
    },

    set(key, value) {
      const entry = { savedAt: now(), value };
      memory.set(key, entry);
      if (!storage) return;
      try {
        storage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(entry));
      } catch {
        // Full or blocked: memory still has it.
      }
    },
  };
}

/** The one cache the responses section shares across pages, made on first use. */
let sharedCache = null;

/**
 * Gets the cache shared by every post's responses section.
 *
 * Returns:
 *     The cache from createCache, using sessionStorage when allowed.
 */
export function responseCache() {
  if (!sharedCache) sharedCache = createCache({ storage: availableSessionStorage() });
  return sharedCache;
}

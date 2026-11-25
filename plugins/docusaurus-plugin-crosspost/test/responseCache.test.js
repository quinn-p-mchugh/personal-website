/**
 * Tests for src/shared/responseCache.js.
 * Run with: npm test   (Node's built-in test runner)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CACHE_KEY_PREFIX, availableSessionStorage, createCache } from "../src/shared/responseCache.js";

/** A Storage stand-in that keeps items in a Map. */
function fakeStorage() {
  const items = new Map();
  return {
    items,
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  };
}

/** A Storage stand-in that refuses everything, as when cookies are blocked. */
const blockedStorage = {
  getItem() {
    throw new Error("SecurityError");
  },
  setItem() {
    throw new Error("SecurityError");
  },
};

test("values are reused until they are too old", () => {
  let time = 1_000;
  const cache = createCache({ storage: fakeStorage(), now: () => time });
  cache.set("a", { likes: [1] });
  assert.deepEqual(cache.get("a", 60_000), { likes: [1] });
  time += 60_001;
  assert.equal(cache.get("a", 60_000), undefined);
  assert.equal(cache.get("a", 0), undefined, "0 minutes: never reused");
});

test("sessionStorage holds the value, so another page of the tab can read it", () => {
  const storage = fakeStorage();
  createCache({ storage, now: () => 5 }).set("a", [1, 2]);
  assert.ok(storage.items.has(`${CACHE_KEY_PREFIX}a`));
  assert.deepEqual(createCache({ storage, now: () => 6 }).get("a", 1000), [1, 2]);
});

test("blocked or broken storage falls back to memory without errors", () => {
  const cache = createCache({ storage: blockedStorage, now: () => 1 });
  cache.set("a", "kept in memory");
  assert.equal(cache.get("a", 1000), "kept in memory");
  const storage = fakeStorage();
  storage.items.set(`${CACHE_KEY_PREFIX}b`, "{not json");
  assert.equal(createCache({ storage }).get("b", 1000), undefined);
});

test("no browser (the build): no sessionStorage", () => {
  assert.equal(availableSessionStorage(), null);
});

/**
 * The plugin's settings: what each one does, its default, and the check
 * Docusaurus runs on them before the build starts.
 *
 * Every setting is optional. A site that sets nothing gets cross-posting to
 * Mastodon and Bluesky, tags as hashtags, images, and responses under posts.
 * Only webmentionUsername has no useful default, so responses stay hidden
 * until it is set.
 *
 * Docs for the check: https://docusaurus.io/docs/api/plugin-methods/static-methods#validateOptions
 * Tests: test/options.test.js
 */
import { createRequire } from "node:module";
import { NETWORKS, PLUGIN_NAME } from "./shared/names.js";

/**
 * Bluesky's limit for one image is 2,000,000 bytes; this leaves a margin.
 * Mastodon allows 16 MB, so Bluesky's limit decides.
 * Docs: https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/embed/images.json
 */
const DEFAULT_MAX_IMAGE_BYTES = 1_900_000;

/** Longest side, in pixels, of a resized image: sharp on phones and most
 * screens, and under the 8.3 megapixels Mastodon shrinks images to. */
const DEFAULT_MAX_IMAGE_SIDE = 2000;

// @docusaurus/utils-validation is CommonJS; require() loads it the same way
// in plain Node and in Docusaurus's config loader.
const { Joi } = createRequire(import.meta.url)("@docusaurus/utils-validation");

/** A list of tag or hashtag names, e.g. ["Meta", "TIL"]. */
const names = Joi.array().items(Joi.string()).default([]);

/** The settings, their defaults and their allowed values. */
export const OPTIONS_SCHEMA = Joi.object({
  // Which networks Bridgy may cross-post to.
  networks: Joi.array()
    .items(Joi.string().valid(...NETWORKS))
    .unique()
    .default([...NETWORKS]),

  // Your webmention.io username (usually your domain). Bridgy sends
  // Mastodon and Bluesky responses there. Docs: https://webmention.io/
  webmentionUsername: Joi.string().allow("").default(""),

  // Profile links that prove you own the site, for signing in to
  // webmention.io; each profile must link back. Docs: https://indielogin.com/setup
  relMe: Joi.array().items(Joi.string().uri()).default([]),

  // Show likes, reposts and replies from Mastodon and Bluesky under posts.
  showResponses: Joi.boolean().default(true),

  // DIRECTION 1: a post's front matter tags -> hashtags in its Mastodon and
  // Bluesky copies. "except" lists tags that never become hashtags there.
  tagsToHashtags: Joi.object({
    enabled: Joi.boolean().default(true),
    except: names,
  }).default(),

  // DIRECTION 2: hashtags written in a post -> tags on the website (tag
  // pages and tag lists). "except" lists hashtags that never become tags.
  // The post's files are never changed; tags are added while building.
  hashtagsToTags: Joi.object({
    enabled: Joi.boolean().default(false),
    except: names,
  }).default(),

  // Images in a post -> pictures attached to its Mastodon and Bluesky copies.
  images: Joi.object({
    enabled: Joi.boolean().default(true),
    // Shrink images that are too big for Bluesky, instead of leaving them out.
    resize: Joi.boolean().default(true),
    // Include images hosted on other websites (downloaded while building).
    remote: Joi.boolean().default(true),
    maxBytes: Joi.number().integer().min(100_000).max(2_000_000).default(DEFAULT_MAX_IMAGE_BYTES),
    maxSide: Joi.number().integer().min(320).max(8000).default(DEFAULT_MAX_IMAGE_SIDE),
  }).default(),
});

/**
 * Checks the settings and fills in defaults.
 *
 * Docusaurus calls this once, before the build, and stops with a clear
 * message naming the setting if one is wrong.
 *
 * Args:
 *     args.options: The settings as written in docusaurus.config.js.
 *     args.validate: Docusaurus's validator.
 *
 * Returns:
 *     The settings with every default filled in.
 */
export function validateOptions({ options, validate }) {
  return validate(OPTIONS_SCHEMA, options);
}

/**
 * Fills in defaults without Docusaurus, for code that runs outside the
 * plugin (the config wrapper) and for tests.
 *
 * Args:
 *     options: The settings as written; may be undefined.
 *
 * Returns:
 *     The settings with every default filled in.
 *
 * Raises:
 *     Error: If a setting is wrong, naming it.
 */
export function normalizeOptions(options = {}) {
  const { error, value } = OPTIONS_SCHEMA.validate(options, { convert: false });
  if (error) throw new Error(`[${PLUGIN_NAME}] ${error.message}`);
  return value;
}

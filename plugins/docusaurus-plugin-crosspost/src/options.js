/**
 * The plugin's settings: what each one does, its default, and the check
 * Docusaurus runs on them before the build starts.
 *
 * Every setting is optional. A site that sets nothing gets cross-posting to
 * Mastodon and Bluesky, tags as hashtags, and images. Responses under posts
 * appear once webmentionUsername is set.
 *
 * Docs for the check: https://docusaurus.io/docs/api/plugin-methods/static-methods#validateOptions
 * Tests: test/options.test.js
 */
import { createRequire } from "node:module";
import { NETWORKS, PLUGIN_NAME } from "./shared/names.js";
import { unknownPlaceholderMessage, unknownPlaceholders } from "./socialText.js";

// @docusaurus/utils-validation is CommonJS; require() loads it the same way
// in plain Node and in Docusaurus's config loader.
const { Joi } = createRequire(import.meta.url)("@docusaurus/utils-validation");

/**
 * Bluesky's limit for one image is 2,000,000 bytes; this leaves a margin.
 * Mastodon allows 16 MB, so Bluesky's limit decides.
 * Docs: https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/embed/images.json
 *       https://docs.joinmastodon.org/user/posting/#attachments
 */
export const DEFAULT_MAX_FILE_SIZE_BYTES = 1_900_000;

/**
 * Longest side, in pixels, of a shrunk image: sharp on phones and most
 * screens, and well under the 8.3 megapixels Mastodon shrinks images to.
 */
export const DEFAULT_MAX_WIDTH_OR_HEIGHT_PIXELS = 2000;

/**
 * One tag or hashtag name. Hashtags may be written with or without "#"
 * ("TIL" or "#TIL"); case, spaces and punctuation don't matter. A name with
 * no letters or digits could never match, so it's refused.
 */
const name = Joi.string()
  .pattern(/[\p{L}\p{N}]/u)
  .messages({ "string.pattern.base": '{{#label}} "{{#value}}" has no letters or digits, so it can never match' });

/** A list of tag or hashtag names, e.g. ["Meta", "#TIL"]. */
const nameList = Joi.array().items(name).default([]);

/**
 * Checks that a template only uses known placeholders.
 *
 * Args:
 *     template: A socialPostTemplates "template" string.
 *     helpers: Joi's custom-validation helpers.
 *
 * Returns:
 *     The template, unchanged, or a Joi error naming the unknown placeholder.
 */
function knownPlaceholders(template, helpers) {
  const unknown = unknownPlaceholders(template);
  // The explanation goes in as a value, not as message text, because Joi
  // would read "{title}" in message text as one of its own placeholders.
  return unknown.length
    ? helpers.message({ custom: "{{#label}} {{#explanation}}" }, { explanation: unknownPlaceholderMessage(unknown) })
    : template;
}

/** A non-empty list of names, for appliesTo conditions. */
const needsOne = { "array.min": "{{#label}} needs at least one entry; leave it out to apply to every post" };
const conditionList = Joi.array().items(name).min(1).messages(needsOne);
const folderList = Joi.array().items(Joi.string().min(1)).min(1).messages(needsOne);

/**
 * One socialPostTemplates rule: which posts it applies to, and their text.
 * Within each appliesTo list, ANY item matches; a post must match ALL of the
 * lists given. A rule without appliesTo applies to every post.
 */
const templateRule = Joi.object({
  appliesTo: Joi.object({
    // Blogs, by content folder as in each blog's "path" setting.
    blogs: folderList,
    // Hashtags written in the post's text (not ones made from its tags).
    hashtags: conditionList,
    // Tags in the post's front matter, by key or label.
    tags: conditionList,
    // true: only posts with a title; false: only posts without one.
    hasTitle: Joi.boolean(),
  }).default({}),
  // The text, written here...
  template: Joi.string().custom(knownPlaceholders),
  // ...or in a file, relative to templatesPath.
  templateFile: Joi.string().min(1),
})
  .xor("template", "templateFile")
  .messages({
    "object.missing": '{{#label}} needs "template" (the text) or "templateFile" (a file holding it)',
    "object.xor": '{{#label}} can have "template" or "templateFile", not both',
  });

/** The settings, their defaults and their allowed values. */
export const OPTIONS_SCHEMA = Joi.object({
  // Which networks Bridgy may cross-post to.
  networks: Joi.array()
    .items(Joi.string().valid(...NETWORKS))
    .unique()
    .min(1)
    .default([...NETWORKS]),

  // Your webmention.io username (usually your domain). Bridgy sends
  // Mastodon and Bluesky responses there. Docs: https://webmention.io/
  webmentionUsername: Joi.string().allow("").default(""),

  // Profile links that prove you own the site, for signing in to
  // webmention.io; each profile must link back. Docs: https://indielogin.com/setup
  relMe: Joi.array().items(Joi.string().uri({ scheme: ["https", "http"] })).default([]),

  // Show likes, reposts and replies from Mastodon and Bluesky under posts.
  showResponses: Joi.boolean().default(true),

  // A post's TAGS -> HASHTAGS in its Mastodon and Bluesky copies.
  tagsToHashtags: Joi.object({
    enabled: Joi.boolean().default(true),
    // Tags that never become hashtags, e.g. ["Meta"].
    excludedTags: nameList,
  }).default(),

  // HASHTAGS written in a post -> TAGS on the website. The post's files are
  // never changed; tags are added while building.
  hashtagsToTags: Joi.object({
    enabled: Joi.boolean().default(false),
    // Hashtags that never become tags, e.g. ["TIL"].
    excludedHashtags: nameList,
  }).default(),

  // A post's IMAGES -> pictures attached to its Mastodon and Bluesky copies.
  images: Joi.object({
    enabled: Joi.boolean().default(true),
    // Shrink images too big for Bluesky, instead of leaving them out.
    shrinkLargeImages: Joi.boolean().default(true),
    // Include images hosted on other websites (downloaded while building).
    includeImagesFromOtherSites: Joi.boolean().default(true),
    maxFileSizeBytes: Joi.number().integer().min(100_000).max(2_000_000).default(DEFAULT_MAX_FILE_SIZE_BYTES),
    maxWidthOrHeightPixels: Joi.number().integer().min(320).max(8000).default(DEFAULT_MAX_WIDTH_OR_HEIGHT_PIXELS),
  }).default(),

  // How each post's text is written on Mastodon and Bluesky. The first rule
  // that applies to a post is used; posts no rule applies to keep the
  // built-in text. See README.md for the placeholders.
  socialPostTemplates: Joi.array().items(templateRule).default([]),

  // Folder holding template files, relative to the site folder (like a
  // blog's "path" setting). Only read when a rule uses templateFile.
  templatesPath: Joi.string().min(1).default("crosspost-templates"),
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
 * Fills in defaults without Docusaurus's validator, for code that runs
 * before plugins load (withCrosspost) and for tests.
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
  if (error) throw new Error(`[${PLUGIN_NAME}] Setting ${error.message}`);
  return value;
}

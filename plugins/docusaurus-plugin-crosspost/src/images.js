/**
 * Attaches a post's images to its Mastodon and Bluesky copies (the "images"
 * setting, on by default).
 *
 * Bridgy only attaches pictures marked `<img class="u-photo">`, and it
 * doesn't shrink them. Bluesky refuses an image over 2,000,000 bytes, which
 * would make the whole Bluesky post fail. So after Docusaurus has built the
 * site, this step goes through each untitled post's page and:
 * 1. finds the images in the post's text (Markdown `![alt](...)`, HTML
 *    `<img>` and MDX `<img src={require(...)}>` all end up as `<img>`),
 * 2. keeps the first 4, the most Mastodon and Bluesky allow,
 * 3. shrinks any that are too big into a copy under /crosspost-images/,
 * 4. adds hidden `<img class="u-photo" alt="...">` copies for Bridgy.
 * The images readers see are not changed. The hidden copies use
 * loading="lazy", so readers' browsers never download them.
 *
 * Titled posts are skipped: Bridgy posts them as "Title: link", and the
 * networks show the post's preview image from the link instead.
 *
 * Docs: https://brid.gy/about (u-photo and alt text)
 *       https://docs.joinmastodon.org/user/posting/#attachments (Mastodon limits)
 *       https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/embed/images.json (Bluesky limits)
 *       https://sharp.pixelplumbing.com/ (the image library)
 * Tests: test/images.test.js
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { decodeHTML } from "entities";
import { DomUtils, parseDocument } from "htmlparser2";
import sharp from "sharp";
import { PLUGIN_NAME } from "./shared/names.js";

/** The most images Mastodon and Bluesky attach to one post. */
export const MAX_IMAGES = 4;

/** Mastodon's alt text limit (1,500 characters on servers before 4.6). */
export const MAX_ALT_CHARACTERS = 1500;

/** Folder, inside the built site, for shrunk copies. */
export const OUTPUT_FOLDER = "crosspost-images";

/** Longest wait for an image on another website, and its largest size. */
const REMOTE_TIMEOUT_MS = 20_000;
const REMOTE_MAX_BYTES = 30_000_000;

/** JPEG and WebP qualities tried in turn when shrinking. */
const QUALITIES = [85, 75, 65, 55, 45];

/** Image formats both networks accept. */
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "gif"]);

/**
 * Prints a warning in the build log, naming the plugin.
 *
 * Args:
 *     message: What happened and what was done about it.
 */
function warn(message) {
  console.warn(`[${PLUGIN_NAME}] ${message}`);
}

/**
 * Lists every HTML file in the built site.
 *
 * Args:
 *     folder: The build folder, or a folder inside it.
 *
 * Returns:
 *     A promise of absolute paths of .html files.
 */
export async function htmlFiles(folder) {
  const entries = await fs.readdir(folder, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) return htmlFiles(full);
      return entry.name.endsWith(".html") ? [full] : [];
    })
  );
  return nested.flat();
}

/**
 * Tells whether an element has a class.
 *
 * Args:
 *     element: An htmlparser2 element.
 *     name: A class name.
 *
 * Returns:
 *     True if the element's class list includes the name.
 */
function hasClass(element, name) {
  return String(element.attribs.class || "").split(/\s+/).includes(name);
}

/**
 * Finds the parts of a post's page this step needs.
 *
 * Args:
 *     html: A built page's HTML.
 *
 * Returns:
 *     { details, images, titled } for a post's own page: details is the
 *     hidden element the plugin's Container adds (data-crosspost-details),
 *     images are the <img> elements in the post's text, in page order, and
 *     titled says whether the post has a title (p-name). null for any other
 *     page.
 */
export function findPostParts(html) {
  const document = parseDocument(html, { withStartIndices: true, withEndIndices: true });
  const entry = DomUtils.findOne((el) => hasClass(el, "h-entry"), document.children, true);
  if (!entry) return null;
  const details = DomUtils.findOne((el) => "data-crosspost-details" in el.attribs, [entry], true);
  const content = DomUtils.findOne((el) => hasClass(el, "e-content"), [entry], true);
  if (!details || !content) return null;
  return {
    details,
    images: DomUtils.findAll((el) => el.name === "img", [content]),
    titled: Boolean(DomUtils.findOne((el) => hasClass(el, "p-name"), [entry], true)),
  };
}

/**
 * Gets an image's alt text ready for Mastodon and Bluesky.
 *
 * Decodes character references once more, because Docusaurus writes the alt
 * text of Markdown images with quotes or "&" escaped twice ("&amp;quot;"),
 * which would otherwise reach the networks as "&quot;". Then shortens text
 * that's too long for Mastodon.
 *
 * Args:
 *     alt: The image's alt attribute, as parsed; may be undefined.
 *     src: The image's address, for the warning.
 *
 * Returns:
 *     Plain alt text, at most MAX_ALT_CHARACTERS long, ending in "…" if cut.
 */
export function socialAltText(alt, src) {
  const text = decodeHTML(String(alt || "")).trim();
  const characters = Array.from(text);
  if (characters.length <= MAX_ALT_CHARACTERS) return text;
  warn(`Alt text of ${src} is ${characters.length} characters; shortened to ${MAX_ALT_CHARACTERS} for Mastodon.`);
  return characters.slice(0, MAX_ALT_CHARACTERS - 1).join("") + "…";
}

/**
 * Works out where an image comes from.
 *
 * Args:
 *     src: The image's src attribute.
 *     pageUrl: The page's full address, for resolving relative addresses.
 *     siteUrl: The site's address, e.g. "https://example.com".
 *     baseUrl: The site's base path, e.g. "/".
 *     outDir: The build folder.
 *
 * Returns:
 *     { url, file } for an image in the built site (file is its path on
 *     disk); { url } for an image on another website; { data } for an image
 *     written into the page (a "data:" address, which Docusaurus uses for
 *     small images); or null for an address that can't be an image.
 */
export function imageSource(src, pageUrl, siteUrl, baseUrl, outDir) {
  if (String(src).startsWith("data:")) {
    const data = dataUrlBytes(src);
    return data ? { data } : null;
  }
  let url;
  try {
    url = new URL(src, pageUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const site = new URL(baseUrl, siteUrl);
  if (url.origin !== site.origin) return { url: url.href };
  if (!url.pathname.startsWith(site.pathname)) return null;
  const relative = decodeURIComponent(url.pathname.slice(site.pathname.length));
  const file = path.resolve(outDir, relative);
  if (!file.startsWith(path.resolve(outDir) + path.sep)) return null;
  return { url: url.href, file };
}

/**
 * Reads the bytes of an image written into a page as a "data:" address.
 *
 * Args:
 *     src: A data: address, e.g. "data:image/png;base64,iVBOR...".
 *
 * Returns:
 *     A Buffer, or null if it isn't an image or can't be read.
 *     Docs: https://developer.mozilla.org/docs/Web/URI/Reference/Schemes/data
 */
export function dataUrlBytes(src) {
  const match = /^data:image\/[\w.+-]+(;[^,]*)?,(.*)$/s.exec(String(src));
  if (!match) return null;
  const [, parameters = "", payload] = match;
  try {
    return parameters.includes(";base64")
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");
  } catch {
    return null;
  }
}

/**
 * Reads an image's bytes, from the build folder or another website.
 *
 * Images from other websites are kept in cacheDir, so later builds don't
 * download them again. Run "npm run clear" to refresh them.
 *
 * Args:
 *     source: From imageSource.
 *     cacheDir: Folder for downloaded images.
 *
 * Returns:
 *     A promise of a Buffer, or null (with a warning) if it can't be read.
 */
export async function readImage(source, cacheDir) {
  if (source.data) return source.data;
  if (source.file) {
    try {
      return await fs.readFile(source.file);
    } catch (error) {
      warn(`Could not read ${source.file} (${error.code}); left out.`);
      return null;
    }
  }
  const cached = path.join(cacheDir, `${sha256(source.url)}.download`);
  try {
    return await fs.readFile(cached);
  } catch {
    // Not downloaded yet.
  }
  try {
    const response = await fetch(source.url, { signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > REMOTE_MAX_BYTES) throw new Error(`${bytes.length} bytes`);
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(cached, bytes);
    return bytes;
  } catch (error) {
    warn(`Could not download ${source.url} (${error.message}); left out.`);
    return null;
  }
}

/**
 * Gives the SHA-256 fingerprint of some data, shortened.
 *
 * Args:
 *     data: A string or Buffer.
 *
 * Returns:
 *     The first 16 hex characters, enough to tell images apart.
 */
function sha256(data) {
  return createHash("sha256").update(data).digest("hex").slice(0, 16);
}

/**
 * Tells whether an image is already fine for both networks.
 *
 * Args:
 *     bytes: The image's file contents.
 *     info: sharp's metadata for it.
 *     limits: { maxBytes, maxSide } from the images setting.
 *
 * Returns:
 *     True if it's small enough, in a format both networks accept.
 */
function fitsAsIs(bytes, info, limits) {
  return (
    ACCEPTED_FORMATS.has(info.format) &&
    bytes.length <= limits.maxBytes &&
    Math.max(info.width || 0, info.height || 0) <= limits.maxSide
  );
}

/**
 * Shrinks an image until it fits the limits.
 *
 * Fits it inside maxSide by maxSide pixels, then lowers the quality step by
 * step, then the size, until the file is at most maxBytes. Photos become
 * JPEG; images with transparency become WebP, which keeps it. Rotation from
 * camera data is applied, and other camera data (like location) is dropped.
 *
 * Args:
 *     bytes: The image's file contents.
 *     info: sharp's metadata for it.
 *     limits: { maxBytes, maxSide }.
 *
 * Returns:
 *     A promise of { bytes, extension }.
 */
export async function shrinkImage(bytes, info, limits) {
  const extension = info.hasAlpha ? "webp" : "jpg";
  let output;
  // Stops at 64 pixels, so a strange image can't loop forever; by then any
  // real image is far under the limit.
  for (let side = limits.maxSide; side >= 64; side = Math.floor(side * 0.75)) {
    for (const quality of QUALITIES) {
      const image = sharp(bytes).rotate().resize(side, side, { fit: "inside", withoutEnlargement: true });
      output = await (extension === "webp" ? image.webp({ quality }) : image.jpeg({ quality, mozjpeg: true })).toBuffer();
      if (output.length <= limits.maxBytes) return { bytes: output, extension };
    }
  }
  return { bytes: output, extension };
}

/**
 * Gets an image ready for Mastodon and Bluesky.
 *
 * Args:
 *     source: From imageSource.
 *     settings: The images setting: { resize, maxBytes, maxSide }.
 *     context: { outDir, siteUrl, baseUrl, cacheDir }.
 *
 * Returns:
 *     A promise of the address Bridgy should fetch: the original when it
 *     already fits; else a copy in /crosspost-images/ (shrunk, or as is for
 *     an image written into the page, which has no address of its own).
 *     null (with a warning) when it can't be used: unreadable, too big with
 *     resizing off, or an animated GIF too big to shrink without freezing it.
 */
export async function socialImageUrl(source, settings, context) {
  const bytes = await readImage(source, context.cacheDir);
  if (!bytes) return null;
  let info;
  try {
    info = await sharp(bytes).metadata();
  } catch (error) {
    warn(`${source.url} isn't an image sharp can read (${error.message}); left out.`);
    return null;
  }
  const label = source.url || "An image written into the page";
  if (fitsAsIs(bytes, info, settings)) {
    if (source.url) return source.url;
    const extension = info.format === "jpeg" ? "jpg" : info.format;
    return publishCopy(`${sha256(bytes)}.${extension}`, bytes, context);
  }
  if (!settings.resize) {
    warn(`${label} is too big for Bluesky and images.resize is off; left out.`);
    return null;
  }
  if ((info.pages || 1) > 1) {
    warn(`${label} is an animated image too big for Bluesky; left out, as shrinking would freeze it.`);
    return null;
  }

  const name = `${sha256(bytes)}-${settings.maxSide}-${settings.maxBytes}`;
  const cached = await cachedShrink(name, context.cacheDir);
  const shrunk = cached || (await shrinkImage(bytes, info, settings));
  if (!cached) await saveShrink(name, shrunk, context.cacheDir);
  return publishCopy(`${name}.${shrunk.extension}`, shrunk.bytes, context);
}

/**
 * Writes an image copy into the built site, under /crosspost-images/.
 *
 * Args:
 *     fileName: The copy's file name, e.g. "3f2a....jpg".
 *     bytes: Its contents.
 *     context: { outDir, siteUrl, baseUrl }.
 *
 * Returns:
 *     A promise of the copy's full address.
 */
async function publishCopy(fileName, bytes, context) {
  await fs.mkdir(path.join(context.outDir, OUTPUT_FOLDER), { recursive: true });
  await fs.writeFile(path.join(context.outDir, OUTPUT_FOLDER, fileName), bytes);
  return new URL(`${OUTPUT_FOLDER}/${fileName}`, new URL(context.baseUrl, context.siteUrl)).href;
}

/**
 * Looks for an image shrunk by an earlier build.
 *
 * Args:
 *     name: The shrunk image's name, without extension.
 *     cacheDir: The cache folder.
 *
 * Returns:
 *     A promise of { bytes, extension }, or null if there is none.
 */
async function cachedShrink(name, cacheDir) {
  for (const extension of ["jpg", "webp"]) {
    try {
      return { bytes: await fs.readFile(path.join(cacheDir, `${name}.${extension}`)), extension };
    } catch {
      // Not this one.
    }
  }
  return null;
}

/**
 * Keeps a shrunk image for later builds.
 *
 * Args:
 *     name: The shrunk image's name, without extension.
 *     shrunk: { bytes, extension }.
 *     cacheDir: The cache folder.
 */
async function saveShrink(name, shrunk, cacheDir) {
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(path.join(cacheDir, `${name}.${shrunk.extension}`), shrunk.bytes);
}

/**
 * Escapes text for an HTML attribute value in double quotes.
 *
 * Args:
 *     text: Any text.
 *
 * Returns:
 *     The text with &, " and < written as character references.
 */
export function escapeAttribute(text) {
  return String(text).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * Builds the hidden images Bridgy attaches.
 *
 * Args:
 *     photos: { url, alt } for each image, in order.
 *
 * Returns:
 *     HTML for one <img class="u-photo"> per image.
 */
export function photoMarkup(photos) {
  return photos
    .map(({ url, alt }) => `<img class="u-photo" loading="lazy" src="${escapeAttribute(url)}" alt="${escapeAttribute(alt)}">`)
    .join("");
}

/**
 * Inserts HTML at the end of an element, changing nothing else.
 *
 * The page's other bytes are kept exactly as Docusaurus wrote them.
 *
 * Args:
 *     html: The page's HTML.
 *     element: An htmlparser2 element parsed from it, with end indices.
 *     insert: The HTML to add as the element's last children.
 *
 * Returns:
 *     The updated HTML.
 */
export function insertAtEnd(html, element, insert) {
  const closingTag = html.lastIndexOf("</", element.endIndex);
  return html.slice(0, closingTag) + insert + html.slice(closingTag);
}

/**
 * Adds social images to one built page.
 *
 * Args:
 *     file: The page's path in the build folder.
 *     settings: The images setting.
 *     context: { outDir, siteUrl, baseUrl, cacheDir }.
 *
 * Returns:
 *     A promise of the number of images added (0 for pages that aren't
 *     untitled posts with images).
 */
export async function addPhotosToPage(file, settings, context) {
  const html = await fs.readFile(file, "utf8");
  if (!html.includes("data-crosspost-details")) return 0;
  const parts = findPostParts(html);
  if (!parts || parts.titled || parts.images.length === 0) return 0;

  const pagePath = path.relative(context.outDir, file).split(path.sep).join("/");
  const pageUrl = new URL(pagePath, new URL(context.baseUrl, context.siteUrl)).href;
  const photos = [];
  for (const img of parts.images) {
    if (photos.length === MAX_IMAGES) {
      warn(`${pagePath} has more than ${MAX_IMAGES} images; only the first ${MAX_IMAGES} are cross-posted.`);
      break;
    }
    const src = img.attribs.src;
    const source = src && imageSource(src, pageUrl, context.siteUrl, context.baseUrl, context.outDir);
    if (!source) continue;
    const isRemote = Boolean(source.url && !source.file);
    if (isRemote && !settings.remote) continue;
    const url = await socialImageUrl(source, settings, context);
    if (url) photos.push({ url, alt: socialAltText(img.attribs.alt, source.url || "an image written into the page") });
  }
  if (!photos.length) return 0;
  await fs.writeFile(file, insertAtEnd(html, parts.details, photoMarkup(photos)));
  return photos.length;
}

/**
 * Adds social images to every post page in the built site.
 *
 * Called from the plugin's postBuild step.
 *
 * Args:
 *     settings: The images setting.
 *     context: { outDir, siteUrl, baseUrl, cacheDir }.
 *
 * Returns:
 *     A promise of { pages, images }: how many pages got images, and how
 *     many images in all.
 */
export async function addSocialImages(settings, context) {
  let pages = 0;
  let images = 0;
  for (const file of await htmlFiles(context.outDir)) {
    const added = await addPhotosToPage(file, settings, context);
    if (added) {
      pages += 1;
      images += added;
    }
  }
  return { pages, images };
}

/**
 * Gets a post's images ready to attach to its Mastodon and Bluesky copies
 * (the "images" setting, on by default).
 *
 * Bridgy only attaches pictures marked `<img class="u-photo">`, and it
 * doesn't shrink them. Bluesky refuses an image over 2,000,000 bytes, which
 * would make the whole Bluesky post fail. So for each image in a post's
 * text (src/postPages.js finds them in the built page), this file:
 * - works out where it comes from: the built site, another website, or a
 *   "data:" address Docusaurus uses for small images;
 * - reads it, downloading images from other websites (cached between
 *   builds);
 * - shrinks it into a copy under /crosspost-images/ if it's too big;
 * - cleans up its alt text.
 * The images readers see are not changed.
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
 *     limits: { maxFileSizeBytes, maxWidthOrHeightPixels } from the images
 *         setting.
 *
 * Returns:
 *     True if it's small enough, in a format both networks accept.
 */
function fitsAsIs(bytes, info, limits) {
  return (
    ACCEPTED_FORMATS.has(info.format) &&
    bytes.length <= limits.maxFileSizeBytes &&
    Math.max(info.width || 0, info.height || 0) <= limits.maxWidthOrHeightPixels
  );
}

/**
 * Shrinks an image until it fits the limits.
 *
 * Fits it inside a maxWidthOrHeightPixels square, then lowers the quality
 * step by step, then the size, until the file is at most maxFileSizeBytes. Photos become
 * JPEG; images with transparency become WebP, which keeps it. Rotation from
 * camera data is applied, and other camera data (like location) is dropped.
 *
 * Args:
 *     bytes: The image's file contents.
 *     info: sharp's metadata for it.
 *     limits: { maxFileSizeBytes, maxWidthOrHeightPixels }.
 *
 * Returns:
 *     A promise of { bytes, extension }. In the unlikely case nothing fits
 *     even at 64 pixels, the smallest attempt.
 */
export async function shrinkImage(bytes, info, limits) {
  const extension = info.hasAlpha ? "webp" : "jpg";
  let output;
  // Stops at 64 pixels, so a strange image can't loop forever; by then any
  // real image is far under the limit.
  for (let side = limits.maxWidthOrHeightPixels; side >= 64; side = Math.floor(side * 0.75)) {
    for (const quality of QUALITIES) {
      const image = sharp(bytes).rotate().resize(side, side, { fit: "inside", withoutEnlargement: true });
      output = await (extension === "webp" ? image.webp({ quality }) : image.jpeg({ quality, mozjpeg: true })).toBuffer();
      if (output.length <= limits.maxFileSizeBytes) return { bytes: output, extension };
    }
  }
  return { bytes: output, extension };
}

/**
 * Gets an image ready for Mastodon and Bluesky.
 *
 * Args:
 *     source: From imageSource.
 *     settings: The images setting.
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
  if (!settings.shrinkLargeImages) {
    warn(`${label} is too big for Bluesky and images.shrinkLargeImages is off; left out.`);
    return null;
  }
  if ((info.pages || 1) > 1) {
    warn(`${label} is an animated image too big for Bluesky; left out, as shrinking would freeze it.`);
    return null;
  }

  const name = `${sha256(bytes)}-${settings.maxWidthOrHeightPixels}-${settings.maxFileSizeBytes}`;
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
 * Gets the images of one post ready for its social posts.
 *
 * Args:
 *     images: The post's <img> elements, in page order, as parsed by
 *         htmlparser2 (each has an "attribs" object).
 *     pageUrl: The post's full address.
 *     settings: The images setting.
 *     context: { outDir, siteUrl, baseUrl, cacheDir }.
 *
 * Returns:
 *     A promise of { url, alt } for up to MAX_IMAGES usable images, in page
 *     order. Images that can't be used are skipped with a warning, and the
 *     next ones move up.
 */
export async function socialPhotos(images, pageUrl, settings, context) {
  const photos = [];
  for (const img of images) {
    if (photos.length === MAX_IMAGES) {
      warn(`${pageUrl} has more than ${MAX_IMAGES} usable images; only the first ${MAX_IMAGES} are cross-posted.`);
      break;
    }
    const src = img.attribs.src;
    const source = src ? imageSource(src, pageUrl, context.siteUrl, context.baseUrl, context.outDir) : null;
    if (!source) continue;
    const fromOtherSite = Boolean(source.url && !source.file);
    if (fromOtherSite && !settings.includeImagesFromOtherSites) continue;
    const url = await socialImageUrl(source, settings, context);
    if (url) photos.push({ url, alt: socialAltText(img.attribs.alt, source.url || "an image written into the page") });
  }
  return photos;
}

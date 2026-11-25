/**
 * Tests for src/images.js.
 * Run with: npm test   (Node 22 or newer; Node's built-in test runner. Uses
 * sharp, so the npm packages must be installed. "Remote" images come from a
 * small web server on this computer, so no internet is needed.)
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { DomUtils, parseDocument } from "htmlparser2";
import sharp from "sharp";
import {
  MAX_ALT_CHARACTERS,
  addPhotosToPage,
  dataUrlBytes,
  findPostParts,
  imageSource,
  insertAtEnd,
  photoMarkup,
  shrinkImage,
  socialAltText,
} from "../src/images.js";

const SITE = "https://example.com";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "crosspost-images-"));
const outDir = path.join(root, "build");
const context = { outDir, siteUrl: SITE, baseUrl: "/", cacheDir: path.join(root, "cache") };
const settings = { enabled: true, resize: true, remote: true, maxBytes: 1_900_000, maxSide: 2000 };
let server;
let remoteBase;

/**
 * Makes an image that compresses badly, so it's big on disk.
 *
 * Args:
 *     width, height: Size in pixels.
 *     channels: 3 for a photo, 4 for one with transparency.
 *
 * Returns:
 *     A sharp pipeline for the image.
 */
function noisyImage(width, height, channels = 3) {
  const pixels = Buffer.alloc(width * height * channels);
  for (let i = 0; i < pixels.length; i += 1) pixels[i] = (i * 2654435761) >>> 13 & 255;
  return sharp(pixels, { raw: { width, height, channels } });
}

/**
 * Writes a built page shaped like the plugin's post pages.
 *
 * Args:
 *     name: Folder name under the build folder.
 *     images: <img> tags for the post's text.
 *     titled: Whether the post has a title.
 *
 * Returns:
 *     The page's path.
 */
function writePage(name, images, titled = false) {
  const title = titled ? '<h1 class="p-name">A title</h1>' : "";
  const html =
    `<!doctype html><html><body><img src="/img/logo.svg" alt="Logo">` +
    `<article class="h-entry">${title}<div class="e-content"><p>Hi</p>${images.join("")}</div>` +
    `<div hidden aria-hidden=true data-crosspost-details=""><a class=u-url href="/${name}"></a></div></article>` +
    `</body></html>`;
  const file = path.join(outDir, name, "index.html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  return file;
}

/**
 * Reads the hidden social images a page now has.
 *
 * Args:
 *     file: The page's path.
 *
 * Returns:
 *     { src, alt } for each <img class="u-photo">, in order.
 */
function photosOn(file) {
  const parts = findPostParts(fs.readFileSync(file, "utf8"));
  const photos = [];
  const walk = (node) => {
    if (node.name === "img" && String(node.attribs.class).includes("u-photo")) photos.push({ src: node.attribs.src, alt: node.attribs.alt });
    (node.children || []).forEach(walk);
  };
  walk(parts.details);
  return photos;
}

before(async () => {
  fs.mkdirSync(path.join(outDir, "assets"), { recursive: true });
  await noisyImage(4000, 3000).jpeg({ quality: 95 }).toFile(path.join(outDir, "assets", "big.jpg"));
  await noisyImage(900, 900, 4).png().toFile(path.join(outDir, "assets", "alpha.png"));
  await sharp({ create: { width: 300, height: 200, channels: 3, background: "#3a7" } }).jpeg().toFile(path.join(outDir, "assets", "small.jpg"));
  const remote = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#a37" } }).png().toBuffer();
  server = http.createServer((req, res) => {
    if (req.url === "/remote.png") {
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(remote);
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  remoteBase = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(root, { recursive: true, force: true });
});

/** Runs a function with build warnings captured instead of printed. */
async function quietly(fn) {
  const warnings = [];
  const original = console.warn;
  console.warn = (message) => warnings.push(String(message));
  try {
    return { result: await fn(), warnings };
  } finally {
    console.warn = original;
  }
}

test("big images are shrunk under the limits; small ones are used as they are", async () => {
  const file = writePage("post-1", ['<img src="/assets/big.jpg" alt="Big">', '<img src="/assets/small.jpg" alt="Small">']);
  const { result } = await quietly(() => addPhotosToPage(file, settings, context));
  assert.equal(result, 2);
  const [big, small] = photosOn(file);
  assert.match(big.src, /^https:\/\/example\.com\/crosspost-images\/[0-9a-f]{16}-2000-1900000\.jpg$/);
  assert.equal(small.src, "https://example.com/assets/small.jpg");
  const copy = path.join(outDir, new URL(big.src).pathname);
  const info = await sharp(copy).metadata();
  assert.ok(fs.statSync(copy).size <= settings.maxBytes);
  assert.ok(Math.max(info.width, info.height) <= settings.maxSide);
});

test("transparent images stay transparent when shrunk", async () => {
  const bytes = fs.readFileSync(path.join(outDir, "assets", "alpha.png"));
  const shrunk = await shrinkImage(bytes, await sharp(bytes).metadata(), { maxBytes: 100_000, maxSide: 2000 });
  assert.equal(shrunk.extension, "webp");
  assert.ok(shrunk.bytes.length <= 100_000);
  assert.equal((await sharp(shrunk.bytes).metadata()).hasAlpha, true);
});

test("remote, data: and HTML images are all used, in order, up to 4", async () => {
  const dataUrl = `data:image/png;base64,${(await sharp({ create: { width: 8, height: 8, channels: 3, background: "#000" } }).png().toBuffer()).toString("base64")}`;
  const file = writePage("post-2", [
    `<img src="${remoteBase}/remote.png" alt="Remote">`,
    `<img src="${dataUrl}" alt="Inline">`,
    `<img src="${remoteBase}/missing.png" alt="Gone">`,
    '<img src="/assets/small.jpg" alt="Third">',
    '<img src="/assets/small.jpg" alt="Fourth">',
    '<img src="/assets/small.jpg" alt="Fifth">',
  ]);
  const { result, warnings } = await quietly(() => addPhotosToPage(file, settings, context));
  assert.equal(result, 4);
  assert.deepEqual(photosOn(file).map((p) => p.alt), ["Remote", "Inline", "Third", "Fourth"]);
  assert.equal(photosOn(file)[0].src, `${remoteBase}/remote.png`);
  assert.match(photosOn(file)[1].src, /\/crosspost-images\/[0-9a-f]{16}\.png$/);
  assert.ok(warnings.some((w) => w.includes("missing.png")), "a failed download is reported");
  assert.ok(warnings.some((w) => w.includes("only the first 4")), "extra images are reported");
});

test("remote images are skipped when images.remote is off", async () => {
  const file = writePage("post-3", [`<img src="${remoteBase}/remote.png" alt="Remote">`]);
  const { result } = await quietly(() => addPhotosToPage(file, { ...settings, remote: false }, context));
  assert.equal(result, 0);
});

test("too-big images are left out when images.resize is off", async () => {
  const file = writePage("post-4", ['<img src="/assets/big.jpg" alt="Big">']);
  const { result, warnings } = await quietly(() => addPhotosToPage(file, { ...settings, resize: false }, context));
  assert.equal(result, 0);
  assert.ok(warnings.some((w) => w.includes("images.resize is off")));
});

test("titled posts and other pages are left alone", async () => {
  const titled = writePage("post-5", ['<img src="/assets/small.jpg" alt="x">'], true);
  const before = fs.readFileSync(titled, "utf8");
  assert.equal(await addPhotosToPage(titled, settings, context), 0);
  assert.equal(fs.readFileSync(titled, "utf8"), before);

  const other = path.join(outDir, "other.html");
  fs.writeFileSync(other, "<html><body><img src=/assets/small.jpg></body></html>");
  assert.equal(await addPhotosToPage(other, settings, context), 0);
});

test("insertAtEnd changes nothing but the inserted part", () => {
  const html = '<div><section data-crosspost-details=""><a href=x></a></section><p>after</p></div>';
  const document = parseDocument(html, { withStartIndices: true, withEndIndices: true });
  const details = DomUtils.findOne((el) => "data-crosspost-details" in el.attribs, document.children, true);
  assert.equal(
    insertAtEnd(html, details, "<i></i>"),
    '<div><section data-crosspost-details=""><a href=x></a><i></i></section><p>after</p></div>'
  );
});

test("alt text is decoded once more and shortened for Mastodon", () => {
  assert.equal(socialAltText('A &quot;quoted&quot; &amp; photo'), 'A "quoted" & photo');
  assert.equal(socialAltText(undefined), "");
  const long = "x".repeat(MAX_ALT_CHARACTERS + 10);
  const quiet = console.warn;
  console.warn = () => {};
  const cut = socialAltText(long, "a.png");
  console.warn = quiet;
  assert.equal(Array.from(cut).length, MAX_ALT_CHARACTERS);
  assert.ok(cut.endsWith("…"));
});

test("photoMarkup escapes addresses and alt text", () => {
  assert.equal(
    photoMarkup([{ url: 'https://a/"x".png', alt: 'Say "<hi>" & bye' }]),
    '<img class="u-photo" loading="lazy" src="https://a/&quot;x&quot;.png" alt="Say &quot;&lt;hi>&quot; &amp; bye">'
  );
});

test("imageSource tells local, remote, data and unusable images apart", () => {
  const page = `${SITE}/blog/post/`;
  assert.deepEqual(imageSource("/assets/a.png", page, SITE, "/", outDir), {
    url: `${SITE}/assets/a.png`,
    file: path.join(outDir, "assets", "a.png"),
  });
  assert.deepEqual(imageSource("https://other.org/b.jpg", page, SITE, "/", outDir), { url: "https://other.org/b.jpg" });
  assert.equal(imageSource("/../../etc/passwd", page, SITE, "/", outDir).file, path.join(outDir, "etc", "passwd"));
  assert.equal(imageSource("javascript:alert(1)", page, SITE, "/", outDir), null);
  assert.equal(imageSource("data:text/html,hi", page, SITE, "/", outDir), null);
  assert.ok(imageSource("data:image/svg+xml,%3Csvg%3E", page, SITE, "/", outDir).data);
  assert.equal(imageSource("/other-base/a.png", page, SITE, "/docs/", outDir), null, "outside the site's base path");
});

test("dataUrlBytes reads base64 and plain data: addresses", () => {
  assert.equal(dataUrlBytes("data:image/png;base64,aGk=").toString(), "hi");
  assert.equal(dataUrlBytes("data:image/svg+xml,%3Csvg%3E").toString(), "<svg>");
  assert.equal(dataUrlBytes("data:text/plain,hi"), null);
});

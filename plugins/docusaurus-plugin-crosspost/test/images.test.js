/**
 * Tests for src/images.js.
 * Run with: npm test   (Node's built-in test runner. Uses
 * sharp, so the npm packages must be installed. Images "from other sites"
 * come from a small web server on this computer, so no internet is needed.)
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { MAX_ALT_CHARACTERS, dataUrlBytes, imageSource, shrinkImage, socialAltText, socialPhotos } from "../src/images.js";
import { normalizeOptions } from "../src/options.js";

const SITE = "https://example.com";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "crosspost-images-"));
const outDir = path.join(root, "build");
const context = { outDir, siteUrl: SITE, baseUrl: "/", cacheDir: path.join(root, "cache") };
const settings = normalizeOptions({}).images;
const pageUrl = `${SITE}/blog/post/`;
let server;
let otherSite;

/**
 * Makes an image that compresses badly, so it's big on disk.
 *
 * Args:
 *     width: Width in pixels.
 *     height: Height in pixels.
 *     channels: 3 for a photo, 4 for one with transparency.
 *
 * Returns:
 *     A sharp pipeline for the image.
 */
function noisyImage(width, height, channels = 3) {
  const pixels = Buffer.alloc(width * height * channels);
  for (let i = 0; i < pixels.length; i += 1) pixels[i] = ((i * 2654435761) >>> 13) & 255;
  return sharp(pixels, { raw: { width, height, channels } });
}

/**
 * Builds a parsed <img> element, as socialPhotos receives them.
 *
 * Args:
 *     src: The src attribute.
 *     alt: The alt attribute.
 *
 * Returns:
 *     An object with an "attribs" property, like htmlparser2's elements.
 */
const img = (src, alt) => ({ attribs: { src, alt } });

/**
 * Runs a function with build warnings captured instead of printed.
 *
 * Args:
 *     fn: An async function.
 *
 * Returns:
 *     A promise of { result, warnings }.
 */
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
  otherSite = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test("big images are shrunk under the limits; small ones are used as they are", async () => {
  const { result } = await quietly(() =>
    socialPhotos([img("/assets/big.jpg", "Big"), img("/assets/small.jpg", "Small")], pageUrl, settings, context)
  );
  const [big, small] = result;
  assert.match(big.url, /^https:\/\/example\.com\/crosspost-images\/[0-9a-f]{16}-2000-1900000\.jpg$/);
  assert.equal(small.url, `${SITE}/assets/small.jpg`);
  const copy = path.join(outDir, new URL(big.url).pathname);
  const info = await sharp(copy).metadata();
  assert.ok(fs.statSync(copy).size <= settings.maxFileSizeBytes);
  assert.ok(Math.max(info.width, info.height) <= settings.maxWidthOrHeightPixels);
});

test("a second build reuses the shrunk copy from the cache", async () => {
  const first = await quietly(() => socialPhotos([img("/assets/big.jpg", "Big")], pageUrl, settings, context));
  const cached = fs.readdirSync(context.cacheDir).filter((name) => name.endsWith(".jpg"));
  assert.equal(cached.length, 1);
  const second = await quietly(() => socialPhotos([img("/assets/big.jpg", "Big")], pageUrl, settings, context));
  assert.equal(second.result[0].url, first.result[0].url);
});

test("transparent images stay transparent when shrunk", async () => {
  const bytes = fs.readFileSync(path.join(outDir, "assets", "alpha.png"));
  const shrunk = await shrinkImage(bytes, await sharp(bytes).metadata(), { maxFileSizeBytes: 100_000, maxWidthOrHeightPixels: 2000 });
  assert.equal(shrunk.extension, "webp");
  assert.ok(shrunk.bytes.length <= 100_000);
  assert.equal((await sharp(shrunk.bytes).metadata()).hasAlpha, true);
});

test("images from other sites, data: images and broken ones, in order, up to 4", async () => {
  const tiny = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#000" } }).png().toBuffer();
  const { result, warnings } = await quietly(() =>
    socialPhotos(
      [
        img(`${otherSite}/remote.png`, "Remote"),
        img(`data:image/png;base64,${tiny.toString("base64")}`, "Inline"),
        img(`${otherSite}/missing.png`, "Gone"),
        img("/assets/small.jpg", "Third"),
        img("/assets/small.jpg", "Fourth"),
        img("/assets/small.jpg", "Fifth"),
      ],
      pageUrl,
      settings,
      context
    )
  );
  assert.deepEqual(result.map((photo) => photo.alt), ["Remote", "Inline", "Third", "Fourth"]);
  assert.equal(result[0].url, `${otherSite}/remote.png`);
  assert.match(result[1].url, /\/crosspost-images\/[0-9a-f]{16}\.png$/);
  assert.ok(warnings.some((w) => w.includes("missing.png")), "a failed download is reported");
  assert.ok(warnings.some((w) => w.includes("only the first 4")), "extra images are reported");
});

test("images from other sites are skipped when includeImagesFromOtherSites is off", async () => {
  const off = { ...settings, includeImagesFromOtherSites: false };
  assert.deepEqual(await socialPhotos([img(`${otherSite}/remote.png`, "Remote")], pageUrl, off, context), []);
});

test("too-big images are left out when shrinkLargeImages is off", async () => {
  const off = { ...settings, shrinkLargeImages: false };
  const { result, warnings } = await quietly(() => socialPhotos([img("/assets/big.jpg", "Big")], pageUrl, off, context));
  assert.deepEqual(result, []);
  assert.ok(warnings.some((w) => w.includes("shrinkLargeImages is off")));
});

test("alt text is decoded once more and shortened for Mastodon", async () => {
  assert.equal(socialAltText("A &quot;quoted&quot; &amp; photo"), 'A "quoted" & photo');
  assert.equal(socialAltText(undefined), "");
  const { result: cut } = await quietly(async () => socialAltText("x".repeat(MAX_ALT_CHARACTERS + 10), "a.png"));
  assert.equal(Array.from(cut).length, MAX_ALT_CHARACTERS);
  assert.ok(cut.endsWith("…"));
});

test("imageSource tells local, other-site, data and unusable images apart", () => {
  assert.deepEqual(imageSource("/assets/a.png", pageUrl, SITE, "/", outDir), {
    url: `${SITE}/assets/a.png`,
    file: path.join(outDir, "assets", "a.png"),
  });
  assert.deepEqual(imageSource("https://other.org/b.jpg", pageUrl, SITE, "/", outDir), { url: "https://other.org/b.jpg" });
  assert.equal(imageSource("/../../etc/passwd", pageUrl, SITE, "/", outDir).file, path.join(outDir, "etc", "passwd"));
  assert.equal(imageSource("javascript:alert(1)", pageUrl, SITE, "/", outDir), null);
  assert.equal(imageSource("data:text/html,hi", pageUrl, SITE, "/", outDir), null);
  assert.ok(imageSource("data:image/svg+xml,%3Csvg%3E", pageUrl, SITE, "/", outDir).data);
  assert.equal(imageSource("/other-base/a.png", pageUrl, SITE, "/docs/", outDir), null, "outside the site's base path");
});

test("dataUrlBytes reads base64 and plain data: addresses", () => {
  assert.equal(dataUrlBytes("data:image/png;base64,aGk=").toString(), "hi");
  assert.equal(dataUrlBytes("data:image/svg+xml,%3Csvg%3E").toString(), "<svg>");
  assert.equal(dataUrlBytes("data:text/plain,hi"), null);
});

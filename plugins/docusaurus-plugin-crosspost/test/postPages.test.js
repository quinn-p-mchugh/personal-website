/**
 * Tests for src/postPages.js.
 * Run with: npm test   (Node 22 or newer; Node's built-in test runner. Needs
 * the npm packages installed, as for a build.)
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DomUtils, parseDocument } from "htmlparser2";
import { normalizeOptions } from "../src/options.js";
import { blogFolderOf, findPostPage, finishPostPages, insertAtEnd, proseText, socialContentHtml } from "../src/postPages.js";

const SITE = "https://example.com";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "crosspost-pages-"));
after(() => fs.rmSync(root, { recursive: true, force: true }));

const siteConfig = {
  url: SITE,
  baseUrl: "/",
  presets: [["classic", { blog: { path: "blog" } }]],
  plugins: [["@docusaurus/plugin-content-blog", { path: "blog-ideas", exclude: ["**/draft/**"] }]],
};

/**
 * Writes a built page shaped like the plugin's post pages.
 *
 * Args:
 *     outDir: The build folder.
 *     name: The page's folder.
 *     post: Fields for the post's JSON description.
 *     body: The post's text, as HTML.
 *
 * Returns:
 *     The page's path.
 */
function writePage(outDir, name, post, body) {
  const description = {
    title: "",
    description: "",
    source: `@site/blog/${name}.md`,
    permalink: `/blog/${name}`,
    date: "2026-11-24T00:00:00.000Z",
    unlisted: false,
    tags: [],
    ...post,
  };
  const json = JSON.stringify(description).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const html =
    `<!doctype html><html><body><article class="h-entry"><div class="e-content">${body}</div>` +
    `<div hidden aria-hidden="true" data-crosspost-post="${json}"><a class="u-url" href="/blog/${name}"></a></div>` +
    `</article></body></html>`;
  const file = path.join(outDir, "blog", name, "index.html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  return file;
}

/**
 * Builds a throwaway site, runs the step, and reads one page's additions.
 *
 * Args:
 *     options: Plugin settings.
 *     pages: [name, post, body] for each page.
 *
 * Returns:
 *     A promise of { additions, manifest, result }: additions maps each
 *     page name to { text, photos, categories }.
 */
async function run(options, pages) {
  const outDir = fs.mkdtempSync(path.join(root, "build-"));
  for (const page of pages) writePage(outDir, ...page);
  const result = await finishPostPages(normalizeOptions(options), {
    outDir,
    siteConfig,
    siteUrl: SITE,
    baseUrl: "/",
    cacheDir: path.join(root, "cache"),
  });
  const additions = {};
  for (const [name] of pages) {
    const html = fs.readFileSync(path.join(outDir, "blog", name, "index.html"), "utf8");
    const details = findPostPage(html).details;
    const text = DomUtils.findOne((el) => String(el.attribs.class || "").includes("e-bridgy-"), [details], true);
    additions[name] = {
      textClasses: text ? text.attribs.class : null,
      text: text ? DomUtils.getInnerHTML(text, { encodeEntities: "utf8" }) : null,
      photos: DomUtils.findAll((el) => el.name === "img", [details]).map((el) => el.attribs.alt),
      categories: DomUtils.findAll((el) => el.name === "data" && el.attribs.class === "p-category", [details]).map((el) => el.attribs.value),
    };
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(outDir, "crosspost.json"), "utf8"));
  return { additions, manifest, result };
}

const climate = [{ key: "Climate", label: "Climate" }];

test("untitled posts get their text and tag hashtags; titled ones keep Bridgy's article form", async () => {
  const { additions } = await run({}, [
    ["note", { tags: climate }, "<p>A note about #Oceans</p>"],
    ["article", { title: "An article" }, "<p>Long text</p>"],
    ["tagged-article", { title: "Tagged", tags: climate }, "<p>Long text</p>"],
  ]);
  assert.equal(additions.note.text, "<p>A note about #Oceans</p><p>#Climate</p>");
  assert.equal(additions.note.textClasses, "e-bridgy-mastodon-content e-bridgy-bluesky-content");
  assert.deepEqual(additions.note.categories, ["Oceans", "Climate"]);
  assert.equal(additions.article.text, null, "a plain titled post is left to Bridgy");
  assert.match(additions["tagged-article"].text, /^<p>Tagged: <a href="https:\/\/example\.com\/blog\/tagged-article">/);
});

test("hashtags in code and links aren't hashtags; excluded tags are left out", async () => {
  const tags = [...climate, { key: "meta", label: "Meta" }];
  const { additions } = await run({ tagsToHashtags: { excludedTags: ["#meta"] } }, [
    ["note", { tags }, '<p>Text <code>#notThis</code> <a href="/x">#norThis</a> #Yes</p>'],
  ]);
  assert.deepEqual(additions.note.categories, ["Yes", "Climate"]);
});

test("templates apply by blog, hashtag and tag; images go with templated posts", async () => {
  const options = {
    networks: ["bluesky"],
    socialPostTemplates: [
      { appliesTo: { hashtags: ["TIL"], tags: ["Climate"] }, template: "TIL+Climate: {title}" },
      { appliesTo: { blogs: ["blog"], hasTitle: true }, template: "{title}\n———\n{content}" },
    ],
  };
  const image = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" alt="Dot">';
  const { additions } = await run(options, [
    ["both", { title: "T", tags: climate }, "<p>#TIL today</p>"],
    ["titled", { title: "T2" }, `<p>Body</p>${image}`],
  ]);
  assert.equal(additions.both.text, "<p>TIL+Climate: T</p>");
  assert.equal(additions.both.textClasses, "e-bridgy-bluesky-content");
  assert.equal(additions.titled.text, "<p>T2<br>———<br>Body</p>");
  assert.deepEqual(additions.titled.photos, ["Dot"], "a templated titled post goes out with its images");
});

test("crosspost.json lists published posts, the blogs and the networks", async () => {
  const { manifest, result } = await run({}, [
    ["b", {}, "<p>B</p>"],
    ["a", {}, "<p>A</p>"],
    ["hidden", { unlisted: true }, "<p>Unlisted</p>"],
  ]);
  assert.equal(manifest.version, 1);
  assert.deepEqual(manifest.networks, ["mastodon", "bluesky"]);
  assert.deepEqual(manifest.blogs.map((blog) => blog.path), ["blog", "blog-ideas"]);
  assert.deepEqual(manifest.blogs[1].exclude, ["**/draft/**"]);
  assert.ok(manifest.blogs[0].exclude.includes("**/_*/**"), "Docusaurus's default exclude");
  assert.deepEqual(manifest.posts.map((p) => [p.source, p.url]), [
    ["blog/a.md", `${SITE}/blog/a`],
    ["blog/b.md", `${SITE}/blog/b`],
  ]);
  assert.equal(result.posts, 2);
});

test("pages without post details are left exactly as they were", async () => {
  const outDir = fs.mkdtempSync(path.join(root, "plain-"));
  const html = "<html><body><article class=h-entry><div class=e-content>#Tag</div></article></body></html>";
  fs.writeFileSync(path.join(outDir, "index.html"), html);
  await finishPostPages(normalizeOptions({}), { outDir, siteConfig, siteUrl: SITE, baseUrl: "/", cacheDir: path.join(root, "cache") });
  assert.equal(fs.readFileSync(path.join(outDir, "index.html"), "utf8"), html);
});

test("insertAtEnd keeps the page's bytes", () => {
  const html = '<div><section data-x=""><a href=x></a></section><p>after</p></div>';
  const document = parseDocument(html, { withStartIndices: true, withEndIndices: true });
  const section = DomUtils.findOne((el) => el.name === "section", document.children, true);
  assert.equal(insertAtEnd(html, section, "<i></i>"), '<div><section data-x=""><a href=x></a><i></i></section><p>after</p></div>');
});

test("socialContentHtml closes tags the minifier left open, and leaves images out", () => {
  const html = '<div class=e-content><p>One &amp; two<p><img src=a.png alt=A><p>Three <a href=/x>link</a></div>';
  const content = DomUtils.findOne((el) => el.name === "div", parseDocument(html).children, true);
  assert.equal(socialContentHtml(content), '<p>One &amp; two</p><p>Three <a href="/x">link</a></p>');
});

test("proseText skips code, links and scripts", () => {
  const document = parseDocument("<p>a <code>#c</code> <a>#l</a> <script>#s</script> b</p>");
  assert.equal(proseText(document).replace(/\s+/g, " ").trim(), "a b");
});

test("blogFolderOf picks the innermost blog folder", () => {
  assert.equal(blogFolderOf("@site/blog-ideas/x.md", ["blog", "blog-ideas"]), "blog-ideas");
  assert.equal(blogFolderOf("@site/blog/sub/x.md", ["blog", "blog/sub"]), "blog/sub");
  assert.equal(blogFolderOf("@site/docs/x.md", ["blog"]), null);
});

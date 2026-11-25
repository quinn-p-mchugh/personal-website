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
import {
  findPostPage,
  finishPostPages,
  insertAtEnd,
  loadedBlogs,
  postPageFile,
  proseText,
  socialContentHtml,
} from "../src/postPages.js";

const SITE = "https://example.com";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "crosspost-pages-"));
after(() => fs.rmSync(root, { recursive: true, force: true }));

/**
 * Makes a post as the blog plugin's content holds it.
 *
 * Args:
 *     name: The post's slug.
 *     fields: Metadata fields to change; frontMatter merges into the default.
 *     blogPath: The blog's folder.
 *
 * Returns:
 *     { metadata } like one of content.blogPosts.
 */
function post(name, fields = {}, blogPath = "blog") {
  return {
    metadata: {
      title: "",
      source: `@site/${blogPath}/${name}.md`,
      permalink: `/${blogPath}/${name}`,
      date: new Date("2026-11-24T00:00:00.000Z"),
      unlisted: false,
      tags: [],
      ...fields,
      frontMatter: { title: fields.title ?? "", ...(fields.frontMatter || {}) },
    },
  };
}

/**
 * Makes a loaded blog plugin, as postBuild's "plugins" holds it.
 *
 * Args:
 *     options: The blog's settings (normalized, as Docusaurus gives them).
 *     posts: Its posts, from post().
 *
 * Returns:
 *     A loaded plugin.
 */
const blogPlugin = (options, posts) => ({ name: "docusaurus-plugin-content-blog", options, content: { blogPosts: posts } });

/**
 * Writes a built page shaped like the plugin's post pages.
 *
 * Args:
 *     file: The page's path.
 *     body: The post's text, as HTML.
 *     markup: false for a page without the plugin's markup.
 */
function writePage(file, body, markup = true) {
  const details = markup ? '<div hidden aria-hidden="true" data-crosspost-details=""><a class="u-url" href="x"></a></div>' : "";
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `<!doctype html><html><body><article class="h-entry"><div class="e-content">${body}</div>${details}</article></body></html>`);
}

/**
 * Builds a throwaway site, runs the step, and reads each page's additions.
 *
 * Args:
 *     options: Plugin settings.
 *     plugins: Loaded plugins.
 *     pages: [permalink, body, markup] for each page to write.
 *     site: Overrides for { baseUrl, trailingSlash }.
 *
 * Returns:
 *     A promise of { additions, manifest, result, outDir }: additions maps
 *     each permalink to { text, textClasses, photos, categories }.
 */
async function run(options, plugins, pages, site = {}) {
  const outDir = fs.mkdtempSync(path.join(root, "build-"));
  const baseUrl = site.baseUrl ?? "/";
  for (const [permalink, body, markup] of pages) {
    const relative = permalink.slice(baseUrl.length);
    writePage(site.trailingSlash === false ? path.join(outDir, `${relative}.html`) : path.join(outDir, relative, "index.html"), body, markup);
  }
  const context = { plugins, siteDir: root, outDir, siteUrl: SITE, baseUrl, trailingSlash: site.trailingSlash, cacheDir: path.join(root, "cache") };
  const result = await finishPostPages(normalizeOptions(options), context);
  const additions = {};
  for (const [permalink, , markup] of pages) {
    if (markup === false) continue;
    const file = await postPageFile(permalink, { outDir, baseUrl, trailingSlash: site.trailingSlash });
    const details = findPostPage(fs.readFileSync(file, "utf8")).details;
    const text = DomUtils.findOne((el) => String(el.attribs.class || "").includes("e-bridgy-"), [details], true);
    additions[permalink] = {
      textClasses: text ? text.attribs.class : null,
      text: text ? DomUtils.getInnerHTML(text, { encodeEntities: "utf8" }) : null,
      photos: DomUtils.findAll((el) => el.name === "img", [details]).map((el) => el.attribs.alt),
      categories: DomUtils.findAll((el) => el.name === "data" && el.attribs.class === "p-category", [details]).map((el) => el.attribs.value),
    };
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(outDir, "crosspost.json"), "utf8"));
  return { additions, manifest, result, outDir };
}

const climate = [{ label: "Climate" }];
const blogOptions = { id: "default", path: "blog", include: ["**/*.{md,mdx}"], exclude: [] };

test("untitled posts get their text and tag hashtags; titled ones keep Bridgy's article form", async () => {
  const plugins = [
    blogPlugin(blogOptions, [
      post("note", { tags: climate, frontMatter: { tags: ["Climate"] } }),
      post("article", { title: "An article" }),
      post("tagged-article", { title: "Tagged", tags: climate }),
    ]),
  ];
  const { additions } = await run({}, plugins, [
    ["/blog/note", "<p>A note about #Oceans</p>"],
    ["/blog/article", "<p>Long text</p>"],
    ["/blog/tagged-article", "<p>Long text</p>"],
  ]);
  assert.equal(additions["/blog/note"].text, "<p>A note about #Oceans</p><p>#Climate</p>");
  assert.equal(additions["/blog/note"].textClasses, "e-bridgy-mastodon-content e-bridgy-bluesky-content");
  assert.deepEqual(additions["/blog/note"].categories, ["Oceans", "Climate"]);
  assert.equal(additions["/blog/article"].text, null, "a plain titled post is left to Bridgy");
  assert.match(additions["/blog/tagged-article"].text, /^<p>Tagged: <a href="https:\/\/example\.com\/blog\/tagged-article">/);
});

test("excluded tags match the tags-file key, even when Docusaurus dropped a repeated tag", async () => {
  const site = fs.mkdtempSync(path.join(root, "site-"));
  fs.mkdirSync(path.join(site, "blog"));
  fs.writeFileSync(path.join(site, "blog", "tags.yml"), "meta:\n  label: Site news\n");
  const plugins = [
    blogPlugin({ ...blogOptions, tags: "tags.yml" }, [
      post("note", { tags: [{ label: "Climate" }, { label: "Site news" }], frontMatter: { tags: ["Climate", "Climate", "meta"] } }),
    ]),
  ];
  const outDir = fs.mkdtempSync(path.join(root, "build-"));
  writePage(path.join(outDir, "blog", "note", "index.html"), "<p>Text</p>");
  await finishPostPages(normalizeOptions({ tagsToHashtags: { excludedTags: ["meta"] } }), {
    plugins, siteDir: site, outDir, siteUrl: SITE, baseUrl: "/", trailingSlash: undefined, cacheDir: path.join(root, "cache"),
  });
  assert.match(fs.readFileSync(path.join(outDir, "blog", "note", "index.html"), "utf8"), /<p>#Climate<\/p><\/div>/);
});

test("templates apply by blog folder or id, hashtag and tag; images go with templated posts", async () => {
  const options = {
    networks: ["bluesky"],
    socialPostTemplates: [
      { appliesTo: { hashtags: ["TIL"], tags: ["Climate"] }, template: "TIL+Climate: {title}" },
      { appliesTo: { blogs: ["ideas"] }, template: "Idea: {title}" },
      { appliesTo: { blogs: ["./blog/"], hasTitle: true }, template: "{title}\n———\n{content}" },
    ],
  };
  const image = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" alt="Dot">';
  const plugins = [
    blogPlugin(blogOptions, [post("both", { title: "T", tags: climate }), post("titled", { title: "T2" })]),
    blogPlugin({ ...blogOptions, id: "ideas", path: "blog-ideas" }, [post("idea", { title: "I" }, "blog-ideas")]),
  ];
  const { additions } = await run(options, plugins, [
    ["/blog/both", "<p>#TIL today</p>"],
    ["/blog/titled", `<p>Body</p>${image}`],
    ["/blog-ideas/idea", "<p>Idea</p>"],
  ]);
  assert.equal(additions["/blog/both"].text, "<p>TIL+Climate: T</p>");
  assert.equal(additions["/blog/both"].textClasses, "e-bridgy-bluesky-content");
  assert.equal(additions["/blog/titled"].text, "<p>T2<br>———<br>Body</p>");
  assert.deepEqual(additions["/blog/titled"].photos, ["Dot"], "a templated titled post goes out with its images");
  assert.equal(additions["/blog-ideas/idea"].text, "<p>Idea: I</p>", "a blog can be named by its id");
});

test("every trailingSlash setting and a baseUrl give the live address", async () => {
  for (const trailingSlash of [true, false, undefined]) {
    const plugins = [blogPlugin(blogOptions, [post("a", { permalink: "/docs-site/blog/a" })])];
    const { manifest } = await run({}, plugins, [["/docs-site/blog/a", "<p>A</p>"]], { baseUrl: "/docs-site/", trailingSlash });
    assert.equal(manifest.posts[0].url, `${SITE}/docs-site/blog/a${trailingSlash ? "/" : ""}`, String(trailingSlash));
  }
});

test("crosspost.json lists published posts and each blog's id, folder and patterns", async () => {
  const plugins = [
    blogPlugin({ id: "default", path: "blog", include: ["**/*.md"], exclude: ["**/_*/**"] }, [post("b"), post("a"), post("hidden", { unlisted: true })]),
    blogPlugin({ id: "ideas", path: "content/ideas" }, []),
    { name: "docusaurus-plugin-content-docs", options: { path: "docs" }, content: {} },
  ];
  const { manifest, result } = await run({}, plugins, [
    ["/blog/b", "<p>B</p>"],
    ["/blog/a", "<p>A</p>"],
    ["/blog/hidden", "<p>Unlisted</p>"],
  ]);
  assert.equal(manifest.version, 1);
  assert.deepEqual(manifest.networks, ["mastodon", "bluesky"]);
  assert.deepEqual(manifest.blogs.map((blog) => [blog.id, blog.path, blog.include]), [
    ["default", "blog", ["**/*.md"]],
    ["ideas", "content/ideas", ["**/*.{md,mdx}"]],
  ]);
  assert.ok(manifest.blogs[1].exclude.includes("**/_*/**"), "Docusaurus's default exclude");
  assert.deepEqual(manifest.posts.map((p) => [p.source, p.url, p.date]), [
    ["blog/a.md", `${SITE}/blog/a`, "2026-11-24T00:00:00.000Z"],
    ["blog/b.md", `${SITE}/blog/b`, "2026-11-24T00:00:00.000Z"],
  ]);
  assert.equal(result.posts, 2);
});

test("posts whose page or markup is missing are reported, not guessed", async () => {
  const plugins = [blogPlugin(blogOptions, [post("plain"), post("gone")])];
  const { result, outDir } = await run({}, plugins, [["/blog/plain", "<p>#Tag</p>", false]]);
  assert.deepEqual(result.withoutMarkup, ["@site/blog/plain.md"]);
  assert.deepEqual(result.withoutPage, ["@site/blog/gone.md"]);
  assert.doesNotMatch(fs.readFileSync(path.join(outDir, "blog", "plain", "index.html"), "utf8"), /p-category/, "left as it was");
});

test("loadedBlogs fills in Docusaurus's defaults and the translations folder", () => {
  const [blog] = loadedBlogs([blogPlugin({}, [])], "/site", "/site/i18n/fr");
  assert.equal(blog.id, "default");
  assert.equal(blog.path, "blog");
  assert.deepEqual(blog.include, ["**/*.{md,mdx}"]);
  assert.equal(blog.localizedFolder, path.join("/site/i18n/fr", "docusaurus-plugin-content-blog"));
  const [other] = loadedBlogs([blogPlugin({ id: "news", path: "/site/content/news" }, [])], "/site", "/site/i18n/fr");
  assert.equal(other.path, "content/news");
  assert.equal(other.localizedFolder, path.join("/site/i18n/fr", "docusaurus-plugin-content-blog-news"));
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

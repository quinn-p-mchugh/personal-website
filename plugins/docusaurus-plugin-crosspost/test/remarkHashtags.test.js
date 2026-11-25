/**
 * Tests for src/remarkHashtags.js.
 * Run with: npm test   (Node 22 or newer; Node's built-in test runner. The
 * tags file tests need the npm packages installed, as for a build).
 * Docs: https://nodejs.org/api/test.html
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import remarkHashtags from "../src/remarkHashtags.js";

/** A throwaway site folder with a shared tags file and one per-blog file. */
const site = fs.mkdtempSync(path.join(os.tmpdir(), "social-hashtags-"));
fs.mkdirSync(path.join(site, "blog-a", "inner"), { recursive: true });
fs.mkdirSync(path.join(site, "blog-b"));
fs.writeFileSync(path.join(site, "content-tags.yml"), "pkm:\n  label: Personal Knowledge Management\nAI:\n");
fs.writeFileSync(path.join(site, "blog-b", "tags.yml"), "pkm:\n  label: Per Blog Label\n");
after(() => fs.rmSync(site, { recursive: true, force: true }));

/**
 * Runs the plugin on a one-paragraph post.
 *
 * Args:
 *     options: Plugin options; siteDir is filled in.
 *     filePath: The post's path inside the throwaway site.
 *     frontMatter: The post's front matter.
 *     body: The paragraph's text.
 *
 * Returns:
 *     { added, categories }: the hidden hashtag text added, and the
 *     p-category values, each as one space-separated string.
 */
async function run(options, filePath, frontMatter, body = "Some text") {
  const tree = { type: "root", children: [{ type: "paragraph", children: [{ type: "text", value: body }] }] };
  const quiet = console.warn;
  console.warn = () => {};
  try {
    await remarkHashtags({ siteDir: site, ...options })(tree, {
      path: path.join(site, filePath),
      data: { frontMatter },
    });
  } finally {
    console.warn = quiet;
  }
  const hidden = JSON.stringify(tree).match(/"value":"(#[^"]*)"/g) || [];
  const added = hidden.map((m) => m.slice(9, -1).trim()).filter((t) => t !== body).join(" ");
  const categories = (tree.children.at(-1).data?.hChildren || []).map((c) => c.properties.value).join(" ");
  return { added, categories };
}

const shared = [{ path: "blog-a", tags: "../content-tags.yml" }];
const untitled = (tags) => ({ title: "", tags });

test("tag keys resolve through the blog's own tags option", async () => {
  assert.equal((await run({ blogs: shared }, "blog-a/p.md", untitled(["pkm"]))).added, "#PersonalKnowledgeManagement");
  assert.equal((await run({ blogs: [{ path: "blog-b" }] }, "blog-b/p.md", untitled(["pkm"]))).added, "#PerBlogLabel");
  assert.equal((await run({ blogs: [{ path: "blog-b", tags: false }] }, "blog-b/p.md", untitled(["pkm"]))).added, "#Pkm");
  assert.equal((await run({ blogs: [{ path: "blog-a" }] }, "blog-a/p.md", untitled(["pkm"]))).added, "#Pkm");
  assert.equal((await run({ blogs: shared }, "blog-a/p.md", untitled(["AI"]))).added, "#Ai", "Docusaurus's default label");
});

test("only files inside a blog folder change; the innermost blog wins", async () => {
  assert.deepEqual(await run({ blogs: shared }, "docs/p.md", untitled(["pkm"])), { added: "", categories: "" });
  assert.equal((await run({ blogs: [{ path: "blog" }] }, "blog-a/p.md", untitled(["pkm"]))).added, "");
  const nested = [{ path: "blog-a", tags: false }, { path: "blog-a/inner", tags: "../../content-tags.yml" }];
  assert.equal((await run({ blogs: nested }, "blog-a/inner/p.md", untitled(["pkm"]))).added, "#PersonalKnowledgeManagement");
});

test("hashtags already in the post aren't repeated, and all are listed as categories", async () => {
  const result = await run({ blogs: shared }, "blog-a/p.md", untitled(["Climate", "Oceans"]), "#climate is here");
  assert.equal(result.added, "#Oceans");
  assert.equal(result.categories, "climate Oceans");
});

test("titled posts get categories but no added text", async () => {
  const result = await run({ blogs: shared }, "blog-a/p.md", { title: "A title", tags: ["Climate"] });
  assert.deepEqual(result, { added: "", categories: "Climate" });
});

test("tagsToHashtags.except and tagsToHashtags.enabled are honoured", async () => {
  const except = { enabled: true, except: ["personal knowledge management"] };
  const excluded = await run({ blogs: shared, tagsToHashtags: except }, "blog-a/p.md",
    untitled(["pkm", "Climate"]));
  assert.equal(excluded.added, "#Climate");
  const off = await run({ blogs: shared, tagsToHashtags: { enabled: false, except: [] } }, "blog-a/p.md", untitled(["Climate"]), "#Own");
  assert.deepEqual(off, { added: "", categories: "Own" });
});

test("numbers, character references and URLs aren't hashtags", async () => {
  const result = await run({ blogs: shared }, "blog-a/p.md", untitled([]), "#1 &#105; https://x.org/#frag C#");
  assert.equal(result.categories, "");
});

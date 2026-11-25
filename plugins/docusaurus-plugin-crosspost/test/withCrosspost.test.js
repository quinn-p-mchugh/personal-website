/**
 * Tests for src/withCrosspost.js.
 * Run with: npm test   (Node 22 or newer; Node's built-in test runner)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import remarkHashtags from "../src/remarkHashtags.js";
import withCrosspost from "../src/withCrosspost.js";

/**
 * Builds a config shaped like a typical site's: the classic preset's blog
 * plus a second blog, sharing one remarkPlugins list.
 *
 * Returns:
 *     { config, shared }: the config and the shared remarkPlugins list.
 */
function sampleConfig() {
  const shared = ["some-other-plugin"];
  const config = {
    presets: [["classic", { blog: { path: "blog", remarkPlugins: shared }, docs: { remarkPlugins: shared } }]],
    plugins: [["@docusaurus/plugin-content-blog", { id: "micro", path: "blog-micro", tags: "../tags.yml", remarkPlugins: shared }]],
  };
  return { config, shared };
}

test("adds the hashtag step to every blog, with that blog's settings, and nowhere else", () => {
  const { config, shared } = sampleConfig();
  withCrosspost(config, {});
  const main = config.presets[0][1].blog.remarkPlugins;
  const micro = config.plugins[0][1].remarkPlugins;
  assert.equal(main.at(-1)[0], remarkHashtags);
  assert.deepEqual(main.at(-1)[1].blogs, [{ path: "blog" }]);
  assert.deepEqual(micro.at(-1)[1].blogs, [{ path: "blog-micro", tags: "../tags.yml" }]);
  assert.deepEqual(shared, ["some-other-plugin"], "the shared list isn't changed");
  assert.equal(config.presets[0][1].docs.remarkPlugins, shared, "docs are left alone");
});

test("adds the plugin with the settings as written", () => {
  const { config } = sampleConfig();
  const options = { webmentionUsername: "example.com" };
  withCrosspost(config, options);
  const [entry, given] = config.plugins.at(-1);
  assert.match(entry, /docusaurus-plugin-crosspost[\\/]src[\\/]index\.js$/);
  assert.equal(given, options);
});

test("adds parseFrontMatter only when hashtagsToTags is on, keeping the site's own", async () => {
  const off = sampleConfig().config;
  withCrosspost(off, {});
  assert.equal(off.markdown, undefined);

  const { config } = sampleConfig();
  const calls = [];
  config.markdown = { mermaid: true, parseFrontMatter: async (params) => (calls.push("site"), params.defaultParseFrontMatter(params)) };
  withCrosspost(config, { hashtagsToTags: { enabled: true } });
  assert.equal(config.markdown.mermaid, true);
  const result = await config.markdown.parseFrontMatter({
    filePath: "/elsewhere/page.md",
    fileContent: "x",
    defaultParseFrontMatter: async () => ({ frontMatter: {}, content: "#Tag" }),
  });
  assert.deepEqual(calls, ["site"]);
  assert.deepEqual(result.frontMatter, {}, "files outside blogs are left alone");
});

test("wrong settings stop the build with a clear message", () => {
  assert.throws(() => withCrosspost(sampleConfig().config, { images: { enabled: "yes" } }), /images\.enabled/);
});

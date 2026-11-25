# docusaurus-plugin-crosspost

Cross-post your Docusaurus blog posts to **Mastodon** and **Bluesky**, and show the **replies, likes and reposts** from there under each post.

It uses [Bridgy Publish](https://brid.gy/about#publish), a free, open-source IndieWeb service, so there are no API keys in your site and nothing to host. Bridgy reads your published post, posts it to your accounts, and sends responses back to your site through [webmention.io](https://webmention.io/).

## What it adds

| Feature | What happens | Setting |
|---|---|---|
| Cross-posting markup | Each post page gets the [microformats](https://microformats.org/wiki/h-entry) Bridgy reads. Untitled posts go out in full (shortened with a link only if too long); titled posts go out as "Title: link", like Micro.blog. | `networks` |
| Your own post text | Rules that choose how a post's text is written on Mastodon and Bluesky, by blog, hashtag, tag or title. | `socialPostTemplates` |
| Tags → hashtags | A post's tags are added as hashtags to its Mastodon and Bluesky copies. | `tagsToHashtags` |
| Hashtags → tags | Hashtags you write in a post become tags on your site. | `hashtagsToTags` |
| Images | A post's images (up to 4, with alt text) are attached to its copies, shrunk if too big for Bluesky. | `images` |
| Responses | Likes, reposts and replies from Mastodon and Bluesky show under each post, with "Reply on" buttons. | `showResponses`, `webmentionUsername` |
| Sender | A command (and a ready-to-copy GitHub Actions workflow) that tells Bridgy about new posts once they're live. | none |

## Install

```bash
npm install docusaurus-plugin-crosspost
```

Then wrap your config with `withCrosspost`. It adds the plugin, and (only if you turn on `hashtagsToTags`) a front matter step that applies to every blog in your config, including blogs you add later:

```js
// docusaurus.config.js
import { withCrosspost } from "docusaurus-plugin-crosspost";

const config = {
  // ...your config, unchanged...
};

export default withCrosspost(config, {
  webmentionUsername: "example.com",
  relMe: ["https://github.com/your-name"],
});
```

A CommonJS config works the same way: `const { withCrosspost } = require("docusaurus-plugin-crosspost");` and `module.exports = withCrosspost(config, {...});`.

Why a wrapper instead of a plain `plugins: [...]` entry? Turning hashtags into tags means changing each post's tags before the blog plugins read them. A Docusaurus plugin can't do that for other plugins, but the site-wide [`markdown.parseFrontMatter`](https://docusaurus.io/docs/api/docusaurus-config#markdown) setting can, and the wrapper sets it for you. If you already have a `parseFrontMatter`, yours still runs first.

## Settings

Every setting is optional. These are the defaults:

```js
{
  // Networks Bridgy may post to.
  networks: ["mastodon", "bluesky"],

  // Your webmention.io username (usually your domain). Responses stay
  // hidden until this is set.
  webmentionUsername: "",

  // Profile links that link back to your site, for signing in to webmention.io.
  relMe: [],

  // Show likes, reposts and replies under each post.
  showResponses: true,

  // A post's TAGS -> HASHTAGS in its Mastodon and Bluesky copies.
  tagsToHashtags: {
    enabled: true,
    excludedTags: [], // tags that never become hashtags there
  },

  // HASHTAGS written in a post -> TAGS on your website.
  hashtagsToTags: {
    enabled: false,
    excludedHashtags: [], // hashtags that never become tags
  },

  // A post's IMAGES -> pictures in its Mastodon and Bluesky copies.
  images: {
    enabled: true,
    shrinkLargeImages: true,           // shrink images too big for Bluesky instead of leaving them out
    includeImagesFromOtherSites: true, // download images hosted on other websites while building
    maxFileSizeBytes: 1900000,         // Bluesky refuses images over 2,000,000 bytes
    maxWidthOrHeightPixels: 2000,      // longest side after shrinking
  },

  // How each post's text is written on Mastodon and Bluesky. See below.
  socialPostTemplates: [],

  // Folder for template files, relative to your site's folder (like a
  // blog's `path` option). Only read if a rule uses `templateFile`.
  templatesPath: "crosspost-templates",
}
```

A setting with a typo, a wrong type or an old name stops the build with a message saying which one, the same way Docusaurus's own settings do.

### The two excluded lists

The hashtag settings work in **opposite directions**, so each has its own list:

- **`tagsToHashtags.excludedTags`** is about your **social posts**. It lists *tags* that should stay off Mastodon and Bluesky. Use it for site-housekeeping tags, like `Meta` or `Site Updates`, that mean nothing to your followers.
- **`hashtagsToTags.excludedHashtags`** is about your **website**. It lists *hashtags* that should not become tags on your site. Use it for hashtags that are useful on social media but would clutter your tag pages, like `TIL` or `100DaysOfCode`.

One shared list would force the same answer both ways, but these cases usually differ: `#TIL` helps people find a post on Mastodon, while a "TIL" tag page on your site is clutter.

Names are compared loosely: case, spaces, punctuation and a leading `#` don't matter, so `"site updates"` matches the tag `Site Updates` and the hashtag `#SiteUpdates`, and `"#TIL"` and `"TIL"` mean the same. An entry can be a tag's key from your tags file or its label. An entry with no letters or digits (like `"#"`) is refused, because it could never match.

### Hashtags → tags

When `hashtagsToTags` is on, a post that says "Reading about #Climate" gets the tag `Climate`. A hashtag that matches a tag in your [tags file](https://docusaurus.io/docs/blog#blog-post-tags), by key or label, uses that tag, so `#PKM` adds your `pkm` tag. Hashtags in code, links and HTML are ignored.

This happens while the site builds, so **your Markdown files never change**: edit or remove the hashtag and the tag follows. If your blog sets [`onInlineTags: "warn"`](https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog#onInlineTags), the build tells you about hashtags that aren't in your tags file yet.

### Social post templates

By default, untitled posts go out in full and titled posts go out as "Title: link" (Bridgy's own [article format](https://brid.gy/about#publish)). Templates let you write the text yourself for some or all posts.

```js
socialPostTemplates: [
  // Posts in the blog-ideas folder that have the #TIL hashtag.
  {
    appliesTo: { blogs: ["blog-ideas"], hashtags: ["TIL"] },
    template: "💡 {title}\n\n{content}\n\n{hashtags}",
  },
  // Any other titled post: the text lives in crosspost-templates/titled.txt.
  { appliesTo: { hasTitle: true }, templateFile: "titled.txt" },
],
```

**Which rule applies.** Rules are checked in order and the first one that matches wins. A post no rule matches keeps the default text. In `appliesTo`:

| Condition | Matches when |
|---|---|
| `blogs: ["blog", "blog-ideas"]` | the post is in **any** of these blog folders (each blog's `path` setting) |
| `hashtags: ["TIL", "#Quote"]` | the post's text has **any** of these hashtags |
| `tags: ["Climate"]` | the post has **any** of these tags (by key or label) |
| `hasTitle: true` / `false` | the post has / doesn't have a title |

When a rule has more than one condition, **all** of them must match. `appliesTo: {}` matches every post, so it works as a catch-all at the end. Hashtags and tags are compared loosely, as above.

**Writing the text.** Give either `template` (the text itself) or `templateFile` (a file in the `templatesPath` folder), not both. The placeholders are:

| Placeholder | Becomes |
|---|---|
| `{title}` | the post's title |
| `{content}` | the post's text. On a line of its own, with blank lines around it, it keeps the post's paragraphs and links; inside a line it is plain text. |
| `{description}` | the `description` from the post's front matter |
| `{url}` | the post's address, as a link |
| `{hashtags}` | the post's tags as hashtags, like `#Climate #Oceans` (without `excludedTags`) |
| `{tags}` | the post's tags as words, like `Climate, Oceans` |

An unknown placeholder, like `{titel}`, stops the build. A blank line starts a new paragraph. **A line that uses an empty placeholder is left out**, so `{title}` on its own line disappears for untitled posts, and a `{hashtags}` line disappears for posts without tags. Placing `{hashtags}` right after `{content}` adds them to the post's last paragraph when that paragraph is only hashtags.

**What Bridgy does with it.** A templated post goes out as a note: your text, plus the post's images when `images` is on. If it's too long for the network (500 characters on most Mastodon servers, 300 on Bluesky), Bridgy shortens it and adds a link to the post. Template files are watched while `docusaurus start` runs; Windows line endings are fine.

### Images

Images are read from the built pages, so Markdown images (`![alt](./photo.jpg)`), HTML `<img>` and MDX `<img src={require(...)}>` all work, with their alt text.

- **Which posts:** untitled posts, and posts sent with a template. Posts that keep the "Title: link" default get no images, so Mastodon and Bluesky show the link's preview card instead.
- **Shrinking:** Bluesky refuses images over 2,000,000 bytes, and Bridgy doesn't shrink them, so one big photo would make the whole Bluesky post fail. Images that are too big are shrunk into a copy under `/crosspost-images/`. The pictures your readers see are not changed.
- **Formats:** photos become JPEG; images with transparency become WebP, which keeps it. Animated images that are too big are left out with a warning, because shrinking would freeze them.
- **Images from other sites:** downloaded during the build and kept in `node_modules/.cache/docusaurus-plugin-crosspost`. Run `docusaurus clear` to download them again.
- **Limits:** only the first 4 images are sent (the limit on both networks); the build warns about the rest. Alt text over 1,500 characters is shortened, the limit on most Mastodon servers.

## Sending posts to Bridgy

Bridgy publishes a post when it gets a [webmention](https://brid.gy/about#webmentions) for it, and only after the post is live. The plugin includes a command that does this.

### The GitHub Actions workflow

Copy [`workflows/crosspost.yml`](workflows/crosspost.yml) from this package into your site's `.github/workflows/` folder, change `SITE_URL`, and commit. No secrets are needed: Bridgy holds the Mastodon and Bluesky logins. The file's comments explain each step. In short:

1. On each push to `main`, it finds the post files that push **added** (edits never re-post).
2. It waits until your host has put them on the live site.
3. It tells Bridgy about each one, retrying if Bridgy is briefly down.
4. It saves the new Mastodon and Bluesky addresses into each post's `syndication` front matter, and commits that.

A daily run re-sends posts added in the last 3 days, in case a push run failed; Bridgy skips anything already published. The "Run workflow" button sends one post by address, and does a dry run unless you untick it.

### The command

```bash
npx docusaurus-plugin-crosspost send --site-url https://example.com --dry-run
```

| Option | What it does |
|---|---|
| `--site-url URL` | The live site's address, with any base path. Required. |
| `--added-since COMMIT` | Send post files added since this commit. With no `--added-since`, `--added-in-last-days`, `--file` or `--url`, it sends the files the current commit added. |
| `--added-in-last-days N` | Send post files added by commits in the last N days. |
| `--file PATH` | Send this file. Repeat for more. |
| `--url URL` | Send this live post address. |
| `--ignore GLOB` | Also skip files matching this pattern, relative to the blog folder. Repeatable. |
| `--save-syndication` | Save the new addresses into each post's front matter. |
| `--dry-run` | Show what would be sent; send nothing. |
| `--wait-minutes N` | How long to wait for posts to go live. Default 20. |
| `--check-every-seconds N` | How often to check while waiting. Default 30. |

It sends a file only if it is a published post: inside a blog folder, not matched by that blog's [`exclude`](https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog#exclude) patterns, dated (by its file name, like `2026-11-24-hello.md` or `2026/11/24/hello.md` ([formats](https://docusaurus.io/docs/blog#blog-post-date)), or by a `date` in its front matter), and not `draft: true` or `unlisted: true`. Each skipped file is listed with the reason.

### How it knows what's live: `crosspost.json`

Each build writes `crosspost.json` at the root of your site. It lists the networks, each blog's folder and `exclude` patterns, and every published post's source file and address. The command reads the live copy, so it never has to guess your URL scheme (slugs, dates, `routeBasePath`) and it knows a post is live when it appears there. It holds nothing that isn't already public on your site.

## Setting up Bridgy and webmention.io

1. Put your site's address in the "website" field of a profile listed in `relMe`, for example your GitHub profile.
2. Sign in at [webmention.io](https://webmention.io/) with your domain, and set `webmentionUsername` to the username it gives you.
3. Connect your Mastodon and Bluesky accounts at [brid.gy](https://brid.gy/), and turn on publishing for each. Bridgy then also collects their responses for your site.
4. Add the workflow above.

## Saving where posts went

The workflow saves a post's Mastodon and Bluesky addresses in its front matter. You can also add them by hand:

```yaml
syndication:
  - https://mastodon.social/@you/123
  - https://bsky.app/profile/you.bsky.social/post/abc
```

The post then shows "Also on Mastodon · Bluesky" links and "Reply on" buttons. These links are also how Bridgy matches replies back to untitled posts.

## Writing untitled posts

Untitled posts must say `title: ""`. Without a title line, Docusaurus uses the file name as the title, and the post goes out as "Title: link".

## Overriding parts

The plugin wraps four theme components with [`@theme-init`](https://docusaurus.io/docs/advanced/client#theme-aliases): `BlogPostItem/Container`, `BlogPostItem/Content`, `BlogPostItem/Header/Title` and `BlogPostItem/Footer`. If your site has its own copy of one of these in `src/theme`, yours replaces the plugin's. Make yours a wrapper ([swizzle with `--wrap`](https://docusaurus.io/docs/swizzling#wrapping)), and it will wrap the plugin's version.

## Requirements

- Docusaurus 3.6 or newer (tested with 3.10), with the classic theme's blog
- Node 20 or newer to build; Node 22 to run the tests

## Development

```bash
npm test   # runs the tests in test/ with Node's built-in test runner
```

## Publishing to npm

The package is marked `"private": true` so it can't be published by accident. To publish it:

1. Remove `"private": true` from `package.json`, and add `repository`, `homepage` and `author` fields.
2. Check the name is free with `npm view docusaurus-plugin-crosspost` (an error means it's free).
3. Run `npm publish --dry-run` and check the file list: only `src/`, `workflows/` and this README should be in it.
4. Run `npm login`, then `npm publish`.
5. In your site, replace the workspace with the published version: remove the `workspaces` entry, run `npm install docusaurus-plugin-crosspost`, and delete the `plugins/` copy.

The [npm docs](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages) cover each step.

## License

MIT

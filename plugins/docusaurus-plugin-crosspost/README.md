# docusaurus-plugin-crosspost

Cross-post your Docusaurus blog posts to **Mastodon** and **Bluesky**, and show the **replies, likes and reposts** from there under each post.

It uses [Bridgy](https://brid.gy/about), a free, open-source IndieWeb service, so there are no API keys in your site and nothing to host. Bridgy reads your published post, posts it to your accounts, and sends responses back to your site through [webmention.io](https://webmention.io/).

## What it adds

| Feature | What happens | Setting |
|---|---|---|
| Cross-posting markup | Each post page gets the [microformats](https://microformats.org/wiki/h-entry) Bridgy reads. Untitled posts go out in full (shortened with a link only if too long); titled posts go out as "Title: link", like Micro.blog. | `networks` |
| Tags → hashtags | A post's tags are added as hashtags to its Mastodon and Bluesky copies. | `tagsToHashtags` |
| Hashtags → tags | Hashtags you write in a post become tags on your site. | `hashtagsToTags` |
| Images | A post's images (up to 4, with alt text) are attached to its copies, shrunk if too big for Bluesky. | `images` |
| Responses | Likes, reposts and replies from Mastodon and Bluesky show under each post, with "Reply on" buttons. | `showResponses`, `webmentionUsername` |

## Install

```bash
npm install docusaurus-plugin-crosspost
```

Then wrap your config with `withCrosspost`. It adds the plugin and the build steps it needs to every blog in your config, including blogs you add later:

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

Why a wrapper instead of a plain `plugins: [...]` entry? A Docusaurus plugin can't add Markdown processing steps to other plugins, and the hashtag features need one in each blog. The wrapper does that for you, so all the settings live in one place.

## Settings

Every setting is optional.

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
  // except: tags that never become hashtags there.
  tagsToHashtags: { enabled: true, except: [] },

  // HASHTAGS written in a post -> TAGS on your website.
  // except: hashtags that never become tags.
  hashtagsToTags: { enabled: false, except: [] },

  // A post's IMAGES -> pictures in its Mastodon and Bluesky copies.
  images: {
    enabled: true,
    resize: true,      // shrink images too big for Bluesky instead of leaving them out
    remote: true,      // include images hosted on other websites
    maxBytes: 1900000, // Bluesky's limit is 2,000,000 bytes per image
    maxSide: 2000,     // longest side in pixels after shrinking
  },
}
```

### The two `except` lists

The hashtag settings work in **opposite directions**, so each has its own list:

- **`tagsToHashtags.except`** is about your **social posts**. It lists *tags* that should stay off Mastodon and Bluesky. Use it for site-housekeeping tags, like `Meta` or `Site Updates`, that mean nothing to your followers.
- **`hashtagsToTags.except`** is about your **website**. It lists *hashtags* that should not become tags on your site. Use it for hashtags that are useful on social media but would clutter your tag pages, like `TIL` or `100DaysOfCode`.

One shared list would force the same answer both ways, but these cases usually differ: `#TIL` helps people find a post on Mastodon, while a "TIL" tag page on your site is clutter.

Names are compared loosely: case, spaces and punctuation don't matter, so `"site updates"` matches the tag `Site Updates` and the hashtag `#SiteUpdates`. An entry can be a tag's key from your tags file or its label.

### Hashtags → tags

When `hashtagsToTags` is on, a post that says "Reading about #Climate" gets the tag `Climate`. A hashtag that matches a tag in your tags file, by key or label, uses that tag, so `#PKM` adds your `pkm` tag. Hashtags in code, links and HTML are ignored.

This happens while the site builds, so **your Markdown files never change**: edit or remove the hashtag and the tag follows. If you set `onInlineTags: "warn"`, the build tells you about hashtags that aren't in your tags file yet.

### Images

Images are read from the built pages, so Markdown images (`![alt](./photo.jpg)`), HTML `<img>` and MDX `<img src={require(...)}>` all work, with their alt text.

- **Shrinking:** Bluesky refuses images over 2,000,000 bytes, and Bridgy doesn't shrink them, so one big photo would make the whole Bluesky post fail. Images that are too big are shrunk into a copy under `/crosspost-images/`. The pictures your readers see are not changed.
- **Formats:** photos become JPEG; images with transparency become WebP, which keeps it. Animated GIFs that are too big are left out with a warning, because shrinking would freeze them.
- **Remote images:** images from other websites are downloaded during the build and kept in `node_modules/.cache/docusaurus-plugin-crosspost`. Run `docusaurus clear` to download them again.
- **Titled posts:** only untitled posts get images. Bridgy posts titled posts as "Title: link", and the networks show the link's preview image instead.
- **Alt text:** longer than 1,500 characters gets shortened, the limit on most Mastodon servers.

## Setting up Bridgy and webmention.io

1. Put your site's address in the "website" field of a profile listed in `relMe`, for example your GitHub profile.
2. Sign in at [webmention.io](https://webmention.io/) with your domain.
3. Connect your Mastodon and Bluesky accounts at [brid.gy](https://brid.gy/). Bridgy then collects their responses for your site.
4. To publish a post, send Bridgy a webmention for it once it's live, as described in [Bridgy's docs](https://brid.gy/about). This plugin marks posts up but doesn't send that webmention; a GitHub Action or other script does, after each deploy.

## Saving where posts went

Add the Mastodon and Bluesky addresses of a post's copies to its front matter, and the post shows "Also on Mastodon · Bluesky" links and "Reply on" buttons:

```yaml
syndication:
  - https://mastodon.social/@you/123
  - https://bsky.app/profile/you.bsky.social/post/abc
```

These links are also how Bridgy matches replies back to untitled posts.

## Writing untitled posts

Untitled posts must say `title: ""`. Without a title line, Docusaurus uses the file name as the title, and the post goes out as "Title: link".

## Overriding parts

The plugin wraps four theme components: `BlogPostItem/Container`, `BlogPostItem/Content`, `BlogPostItem/Header/Title` and `BlogPostItem/Footer`. If your site has its own copy of one of these in `src/theme`, yours replaces the plugin's. Make yours a wrapper ([swizzle with `--wrap`](https://docusaurus.io/docs/swizzling#wrapping)), and it will wrap the plugin's version.

## Requirements

- Docusaurus 3.6 or newer (tested with 3.10), with the classic theme's blog
- Node 20 or newer

## Development

```bash
npm test   # runs the tests in test/ with Node's built-in test runner
```

## License

MIT

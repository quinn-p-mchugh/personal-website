# Changelog

All notable changes to this plugin. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Before 1.0.0, a minor version (0.x.0) may change settings in ways that need your config updated; each such change is listed under **Changed** with what to do.

## [0.2.0] - 2026-11-25

### Changed
- **Settings renamed for clarity.** The build stops with a message naming the new setting if an old one is used.
  - `showResponses` → `responses.enabled` (see the new `responses` group below).
  - Excluded tags and hashtags: `tagsToHashtags.excludedTags` and `hashtagsToTags.excludedHashtags`.
  - Images: `images.shrinkLargeImages`, `images.includeImagesFromOtherSites`, `images.maxFileSizeBytes`, `images.maxWidthOrHeightPixels`.
  - Social post template rules use `appliesTo` (not `when`).
- **Blogs are read from what Docusaurus loaded** (postBuild's `plugins`), so every way of setting up a blog works: the classic preset with or without a `blog` option, `content-blog` shorthands and file paths, other authors' presets, and configs written as functions.
- **Sending undated posts:** the `send` command now sends posts without a date in their file name or front matter; `--skip-undated` leaves them out.
- **The workflow's saved-address commits** now keep each post's author and date, so Docusaurus's "Last updated" still shows your last edit. Copy the updated `workflows/crosspost.yml`.
- **Responses section redesigned.** It's now the theme components `CrosspostResponses` and `CrosspostSyndicationLinks`, styled by `src/client/crosspost.css` with stable `crosspost-…` classes and CSS variables instead of a CSS module. If you styled the old hashed class names, move those rules to the new classes; see "Styling the responses" in the README.

### Added
- `responses` settings: `enabled`, `showLikes`, `showReposts`, `showReplies`, `maxAvatarsShown`, `maxRepliesShown`, `replyOrder`, `showQuotes`, `cacheMinutes`, `showReplyButtons`, `headingLevel`. Hide the section on one post with `crosspost_responses: false` in its front matter.
- `showSyndicationLinks`: hide the "Also on" line while keeping the hidden markup Bridgy needs.
- Bluesky quote posts in the responses section, from Bluesky's public API.
- Responses are reused for `cacheMinutes` in the reader's browser (sessionStorage, or memory when storage is blocked; no cookies).
- A "+N more" list of everyone who liked or reposted, in an accessible dialog; reply links; brand-colored reply buttons.
- `socialPostTemplates`: write each post's social text yourself, chosen by blog, hashtag, tag or title.
- The `send` command and a ready-to-copy GitHub Actions workflow, replacing the earlier Python script.
- i18n: all text goes through Docusaurus's `translate()` (ids `crosspost.responses.*`).
- `getSwizzleConfig`: the display components are safe to swizzle; the Bridgy markup wrappers are wrap-only.

### Fixed
- Post addresses follow the `trailingSlash` setting, as Docusaurus's own feeds do.
- Post text with images is re-serialized as balanced HTML, since the minifier drops optional `</p>` tags.
- Avatars can't be stretched by site rules like `article img { width: 100% }`.
- Responses are found whether a site redirects to or from `www.`.
- Pages and `crosspost.json` are written in one step, since the blog feed reads pages at the same time.
- Tests run on Node 20 as well as 22.

## [0.1.0] - 2026-11-24

### Added
- First version: cross-posting markup for Bridgy, tags as hashtags, hashtags as tags, images (with shrinking), and Mastodon and Bluesky responses under each post.

[0.2.0]: https://github.com/quinn-p-mchugh/personal-website/pull/64
[0.1.0]: https://github.com/quinn-p-mchugh/personal-website/pull/60

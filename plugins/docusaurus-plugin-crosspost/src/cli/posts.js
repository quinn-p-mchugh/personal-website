/**
 * Decides which added files are blog posts to cross-post.
 *
 * A file is cross-posted when it is a Markdown file in one of the site's
 * blogs (as listed in the live site's crosspost.json), isn't left out by
 * that blog's "exclude" patterns or the --ignore option, isn't a draft or
 * unlisted, and has a date: in its front matter, or in its path like
 * "2026-11-24-my-post.md". Undated pages, like a blog's welcome page, are
 * never cross-posted, because Docusaurus would date them by their last
 * change.
 * Docs: https://docusaurus.io/docs/blog#blog-post-date
 *       https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog#configuration
 * Tests: test/cli/posts.test.js
 */
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

/**
 * Docusaurus's rule for a date in a post's path, relative to its blog
 * folder (2026-11-23-my-post.md, 2026/11/23/my-post.md,
 * 2026-11-23-my-post/index.md). Copied from DATE_FILENAME_REGEX in
 * @docusaurus/plugin-content-blog/lib/blogUtils.js (3.10).
 */
const DATE_IN_PATH = /^(?<folder>.*)(?<date>\d{4}[-/]\d{1,2}[-/]\d{1,2})[-/]?(?<text>.*?)(?:\/index)?.mdx?$/;

/**
 * Finds which blog a file is in.
 *
 * Args:
 *     file: A path relative to the site folder, with "/".
 *     blogs: { path, exclude } for each blog, from crosspost.json.
 *
 * Returns:
 *     { blog, relative }: the blog, and the file's path inside its folder;
 *     null if the file isn't in a blog. The innermost blog wins.
 */
export function blogOfFile(file, blogs) {
  const tidy = (folder) => folder.replace(/^\.\//, "").replace(/\/+$/, "");
  const blog = blogs
    .filter((candidate) => file.startsWith(`${tidy(candidate.path)}/`))
    .sort((a, b) => tidy(b.path).length - tidy(a.path).length)[0];
  return blog ? { blog, relative: file.slice(tidy(blog.path).length + 1) } : null;
}

/**
 * Tells whether a path matches any glob pattern, the way Docusaurus
 * matches a blog's "exclude" patterns.
 *
 * Args:
 *     relative: A path inside a blog folder.
 *     patterns: Glob patterns, e.g. ["**\/_*.md"].
 *
 * Returns:
 *     True if any pattern matches.
 */
export function matchesAny(relative, patterns) {
  const { createMatcher } = require("@docusaurus/utils");
  return createMatcher(patterns)(relative);
}

/**
 * Reads a post's front matter the way Docusaurus does.
 *
 * Args:
 *     file: The post file's path.
 *
 * Returns:
 *     A promise of the front matter object; {} if the file has none or
 *     can't be read or parsed.
 */
export async function readFrontMatter(file) {
  try {
    const { DEFAULT_PARSE_FRONT_MATTER } = require("@docusaurus/utils");
    const fileContent = await fs.readFile(file, "utf8");
    return (await DEFAULT_PARSE_FRONT_MATTER({ filePath: file, fileContent })).frontMatter || {};
  } catch {
    return {};
  }
}

/**
 * Explains why an added file won't be cross-posted.
 *
 * Args:
 *     file: A path relative to the site folder, with "/".
 *     blogs: { path, exclude } for each blog, from crosspost.json.
 *     ignore: Extra glob patterns from --ignore, matched against the path
 *         inside the blog folder.
 *     root: The site folder.
 *
 * Returns:
 *     A promise of the reason, or null when the file is a post to send.
 *     "" means "not a blog post at all" (nothing worth printing).
 */
export async function skipReason(file, blogs, ignore, root = process.cwd()) {
  if (!/\.mdx?$/.test(file)) return "";
  const located = blogOfFile(file, blogs);
  if (!located) return "";
  if (matchesAny(located.relative, located.blog.exclude || [])) return "left out by the blog's exclude setting";
  if (ignore.length && matchesAny(located.relative, ignore)) return "matches --ignore";
  const fullPath = path.join(root, file);
  try {
    await fs.access(fullPath);
  } catch {
    return "file no longer exists";
  }
  const frontMatter = await readFrontMatter(fullPath);
  if (frontMatter.draft === true) return "draft: true";
  if (frontMatter.unlisted === true) return "unlisted: true";
  if (!frontMatter.date && !DATE_IN_PATH.test(located.relative)) return "no date (pages without one aren't cross-posted)";
  return null;
}

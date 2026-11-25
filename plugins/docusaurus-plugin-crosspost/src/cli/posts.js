/**
 * Decides which added files are blog posts to cross-post.
 *
 * A file is cross-posted when it is in one of the site's blogs (as listed
 * in the live site's crosspost.json), matches that blog's "include"
 * patterns and not its "exclude" patterns (exactly as Docusaurus decides
 * which files are posts), doesn't match the --ignore option, and isn't a
 * draft or unlisted. Posts without a date in their path or front matter
 * are sent too, since Docusaurus dates them by the file's creation time;
 * --skip-undated leaves them out (for example, a blog's welcome page).
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

/** Docusaurus's default "include" for a blog, for an older crosspost.json
 * that doesn't list it. */
const DEFAULT_INCLUDE = ["**/*.{md,mdx}"];

/**
 * Tells whether a post's path, inside its blog folder, carries a date the
 * way Docusaurus reads one.
 *
 * Args:
 *     relative: The path inside the blog folder, with "/".
 *
 * Returns:
 *     True for paths like "2026-11-24-my-post.md" or "2026/11/24/my-post.md".
 */
export function hasDateInPath(relative) {
  return DATE_IN_PATH.test(relative);
}

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
 *     choices: { ignore, skipUndated }: ignore holds extra glob patterns
 *         from --ignore, matched against the path inside the blog folder;
 *         skipUndated leaves out posts without a date in their path or
 *         front matter.
 *     root: The site folder.
 *
 * Returns:
 *     A promise of the reason, or null when the file is a post to send.
 *     "" means "not a blog post at all" (nothing worth printing).
 */
export async function skipReason(file, blogs, choices, root = process.cwd()) {
  const { ignore = [], skipUndated = false } = choices;
  const located = blogOfFile(file, blogs);
  if (!located) return "";
  // Images and other files in a blog folder aren't posts: say nothing.
  if (!matchesAny(located.relative, located.blog.include || DEFAULT_INCLUDE)) return "";
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
  if (skipUndated && !frontMatter.date && !hasDateInPath(located.relative)) return "no date in its file name or front matter (--skip-undated)";
  return null;
}

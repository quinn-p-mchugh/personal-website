/**
 * Saves where a post was cross-posted into its front matter, as a
 * "syndication" list:
 *
 *     syndication:
 *       - https://mastodon.social/@you/123
 *       - https://bsky.app/profile/you.bsky.social/post/abc
 *
 * The site shows these as "Also on Mastodon · Bluesky" links, and Bridgy
 * needs them to match replies back to posts that went out without a link.
 * Docs: https://indieweb.org/rel-syndication
 *
 * The file is edited as text, not re-written from parsed YAML, so
 * everything else in it (comments, quoting, order, line endings, a
 * byte-order mark) stays exactly as written.
 * Tests: test/cli/syndication.test.js
 */
import fs from "node:fs/promises";
import { say } from "./log.js";

/** A top-level "syndication:" line, and a YAML list item ("  - value"). */
const SYNDICATION_KEY = /^syndication\s*:(.*)$/;
const LIST_ITEM = /^(\s*)-(?:\s|$)/;

/**
 * Cleans one front matter value the way YAML reads simple values.
 *
 * Args:
 *     raw: The text after "key:", e.g. ' "my #1 post"  # note'.
 *
 * Returns:
 *     The value, e.g. "my #1 post". A quoted value keeps everything inside
 *     its quotes, including " #"; an unquoted one loses a " # comment".
 */
export function frontMatterValue(raw) {
  const value = String(raw).trim();
  if (value.startsWith("'") || value.startsWith('"')) {
    const closing = value.indexOf(value[0], 1);
    return closing === -1 ? value.slice(1) : value.slice(1, closing);
  }
  return value.split(" #")[0].trim();
}

/**
 * Splits a Markdown file into its front matter and the rest.
 *
 * Args:
 *     text: The whole file, without a byte-order mark.
 *
 * Returns:
 *     { opening, frontMatter, rest }: the opening "---" line, the lines
 *     between the fences, and everything from the closing "---" on. null if
 *     the file has no front matter.
 */
export function splitFrontMatter(text) {
  const match = /^(---[ \t]*\r?\n)([\s\S]*?)(^---[ \t]*(?:\r?\n|$)[\s\S]*)/m.exec(text);
  if (!match || match.index !== 0) return null;
  return { opening: match[1], frontMatter: match[2], rest: match[3] };
}

/**
 * Adds addresses to the "syndication" list in front matter text.
 *
 * Adds a list when there's no "syndication" key, turns an empty inline list
 * ("syndication: []") into a block list, and extends an existing block
 * list, keeping its indentation. Addresses already listed aren't repeated.
 *
 * Args:
 *     frontMatter: The lines between the "---" fences.
 *     urls: Addresses to add.
 *     newline: The file's line ending, "\n" or "\r\n".
 *
 * Returns:
 *     The updated front matter; the same text if every address is listed.
 *
 * Raises:
 *     Error: If "syndication" holds something this can't safely extend,
 *         like a non-empty inline list.
 */
export function addSyndicationLines(frontMatter, urls, newline) {
  const lines = frontMatter.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  const keyIndex = lines.findIndex((line) => SYNDICATION_KEY.test(line));
  if (keyIndex === -1) {
    return [...lines, "syndication:", ...urls.map((url) => `  - ${url}`)].join(newline) + newline;
  }
  const inline = frontMatterValue(SYNDICATION_KEY.exec(lines[keyIndex])[1]);
  if (inline !== "" && inline !== "[]") throw new Error(`"syndication: ${inline}" isn't a list this can add to`);

  let end = keyIndex + 1;
  while (end < lines.length && LIST_ITEM.test(lines[end])) end += 1;
  const items = lines.slice(keyIndex + 1, end);
  const indent = items.length ? LIST_ITEM.exec(items[0])[1] : "  ";
  const existing = new Set(items.map((item) => frontMatterValue(item.replace(LIST_ITEM, ""))));
  const added = urls.filter((url) => !existing.has(url)).map((url) => `${indent}- ${url}`);
  if (!added.length) return frontMatter;
  return [...lines.slice(0, keyIndex), "syndication:", ...items, ...added, ...lines.slice(end)].join(newline) + newline;
}

/**
 * Saves a post's cross-posted addresses into its file.
 *
 * Args:
 *     file: The post file's path.
 *     urls: Addresses of its Mastodon and Bluesky copies.
 *
 * Returns:
 *     A promise of true if the file changed. false, with a printed note,
 *     when there was nothing to add or the file couldn't be safely updated.
 */
export async function saveSyndication(file, urls) {
  if (!urls.length) return false;
  let raw;
  try {
    // fatal: refuse invalid UTF-8; ignoreBOM: keep a byte-order mark, to write it back.
    raw = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(await fs.readFile(file));
  } catch (error) {
    say(`  note    couldn't read ${file} (${error.code || error.message}); not saved: ${urls.join(", ")}`);
    return false;
  }
  const bom = raw.startsWith("﻿") ? "﻿" : "";
  const parts = splitFrontMatter(raw.slice(bom.length));
  if (!parts) {
    say(`  note    ${file} has no front matter; not saved: ${urls.join(", ")}`);
    return false;
  }
  const newline = parts.opening.includes("\r\n") ? "\r\n" : "\n";
  let updated;
  try {
    updated = addSyndicationLines(parts.frontMatter, urls, newline);
  } catch (error) {
    say(`  note    ${file}: ${error.message}; not saved: ${urls.join(", ")}`);
    return false;
  }
  if (updated === parts.frontMatter) return false;
  try {
    await fs.writeFile(file, bom + parts.opening + updated + parts.rest);
  } catch (error) {
    say(`  note    couldn't write ${file} (${error.code}); not saved: ${urls.join(", ")}`);
    return false;
  }
  say(`  saved where ${file} was posted: ${urls.join(", ")}`);
  return true;
}

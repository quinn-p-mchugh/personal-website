/**
 * Tests for src/cli/syndication.js.
 * Run with: npm test   (Node's built-in test runner)
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { addSyndicationLines, frontMatterValue, saveSyndication, splitFrontMatter } from "../../src/cli/syndication.js";

const URLS = ["https://a.social/1", "https://bsky.app/2"];
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "crosspost-syndication-"));
after(() => fs.rmSync(folder, { recursive: true, force: true }));

/** Runs a function with console.log silenced. */
async function quietly(fn) {
  const original = console.log;
  console.log = () => {};
  try {
    return await fn();
  } finally {
    console.log = original;
  }
}

test("frontMatterValue reads quoted and commented values like YAML", () => {
  assert.equal(frontMatterValue(' "my #1 post"  # note'), "my #1 post");
  assert.equal(frontMatterValue(" plain # comment"), "plain");
  assert.equal(frontMatterValue(" 'single'"), "single");
  assert.equal(frontMatterValue(' "unclosed'), "unclosed");
  assert.equal(frontMatterValue(""), "");
});

test("splitFrontMatter finds the fences, and only at the start", () => {
  assert.deepEqual(splitFrontMatter("---\na: 1\n---\nbody"), { opening: "---\n", frontMatter: "a: 1\n", rest: "---\nbody" });
  assert.equal(splitFrontMatter("text\n---\na: 1\n---\n"), null);
  assert.equal(splitFrontMatter("no front matter"), null);
});

test("addSyndicationLines handles every list shape", () => {
  assert.equal(addSyndicationLines("title: x\n", URLS, "\n"), "title: x\nsyndication:\n  - https://a.social/1\n  - https://bsky.app/2\n");
  assert.equal(addSyndicationLines("syndication: []  # c\n", URLS.slice(0, 1), "\n"), "syndication:\n  - https://a.social/1\n");
  assert.equal(
    addSyndicationLines('syndication:\n- "https://old/0"\nt: x\n', URLS.slice(0, 1), "\n"),
    'syndication:\n- "https://old/0"\n- https://a.social/1\nt: x\n',
    "keeps unindented items valid"
  );
  const complete = "syndication:\n  - https://a.social/1\n  - https://bsky.app/2\n";
  assert.equal(addSyndicationLines(complete, URLS, "\n"), complete, "no repeats");
  assert.equal(addSyndicationLines("", URLS.slice(0, 1), "\n"), "syndication:\n  - https://a.social/1\n");
  assert.throws(() => addSyndicationLines("syndication: [x]\n", URLS, "\n"), /isn't a list/);
});

test("saveSyndication keeps the byte-order mark and Windows line endings", async () => {
  const file = path.join(folder, "post.md");
  fs.writeFileSync(file, '﻿---\r\ntitle: ""\r\n---\r\nbody\r\n');
  assert.equal(await quietly(() => saveSyndication(file, URLS)), true);
  assert.equal(await quietly(() => saveSyndication(file, URLS)), false, "already there");
  assert.equal(
    fs.readFileSync(file, "utf8"),
    '﻿---\r\ntitle: ""\r\nsyndication:\r\n  - https://a.social/1\r\n  - https://bsky.app/2\r\n---\r\nbody\r\n'
  );
});

test("saveSyndication skips files it can't safely change", async () => {
  fs.writeFileSync(path.join(folder, "none.md"), "no front matter\n");
  fs.writeFileSync(path.join(folder, "bad.md"), Buffer.from([0x2d, 0x2d, 0x2d, 0x0a, 0xff, 0x0a, 0x2d, 0x2d, 0x2d, 0x0a]));
  for (const name of ["none.md", "bad.md", "missing.md"]) {
    assert.equal(await quietly(() => saveSyndication(path.join(folder, name), URLS)), false, name);
  }
  assert.equal(await quietly(() => saveSyndication(path.join(folder, "none.md"), [])), false);
});

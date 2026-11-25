/**
 * Tests for src/shared/files.js.
 * Run with: npm test   (Node's built-in test runner)
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeFileSafely } from "../src/shared/files.js";

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "crosspost-files-"));
after(() => fs.rmSync(folder, { recursive: true, force: true }));

test("writeFileSafely replaces the file and leaves no temporary file", async () => {
  const file = path.join(folder, "page.html");
  fs.writeFileSync(file, "old");
  await writeFileSafely(file, "new");
  assert.equal(fs.readFileSync(file, "utf8"), "new");
  assert.deepEqual(fs.readdirSync(folder), ["page.html"]);
});

test("writeFileSafely cleans up when it can't write", async () => {
  await assert.rejects(writeFileSafely(path.join(folder, "missing-folder", "page.html"), "x"));
  assert.deepEqual(fs.readdirSync(folder), ["page.html"]);
});

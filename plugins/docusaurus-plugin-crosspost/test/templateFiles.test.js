/**
 * Tests for src/templateFiles.js.
 * Run with: npm test   (Node's built-in test runner)
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadTemplateFiles } from "../src/templateFiles.js";

const site = fs.mkdtempSync(path.join(os.tmpdir(), "crosspost-templates-"));
fs.mkdirSync(path.join(site, "crosspost-templates"));
fs.writeFileSync(path.join(site, "crosspost-templates", "ideas.txt"), "💡 {title}\r\n\r\n{content}\r\n");
fs.writeFileSync(path.join(site, "crosspost-templates", "typo.txt"), "{titel}");
after(() => fs.rmSync(site, { recursive: true, force: true }));

test("template files are read relative to templatesPath, with Windows line endings evened out", () => {
  const rules = [{ appliesTo: {}, templateFile: "ideas.txt" }, { appliesTo: {}, template: "inline" }];
  const loaded = loadTemplateFiles(rules, "crosspost-templates", site);
  assert.equal(loaded[0].template, "💡 {title}\n\n{content}");
  assert.equal(loaded[1], rules[1], "inline rules are unchanged");
});

test("an absolute templatesPath works too", () => {
  const loaded = loadTemplateFiles([{ appliesTo: {}, templateFile: "ideas.txt" }], path.join(site, "crosspost-templates"), "/elsewhere");
  assert.match(loaded[0].template, /^💡/);
});

test("a missing file or an unknown placeholder stops with the file's name", () => {
  assert.throws(() => loadTemplateFiles([{ templateFile: "nope.txt" }], "crosspost-templates", site), /socialPostTemplates\[0\].*nope\.txt.*ENOENT/s);
  assert.throws(() => loadTemplateFiles([{ templateFile: "typo.txt" }], "crosspost-templates", site), /typo\.txt.*\{titel\}/);
});

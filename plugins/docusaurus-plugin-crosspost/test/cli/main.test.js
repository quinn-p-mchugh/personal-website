/**
 * Tests for src/cli/main.js's argument parsing.
 * Run with: npm test   (Node 22 or newer; Node's built-in test runner)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCommandLine } from "../../src/cli/main.js";

test("send's options are read and defaulted", () => {
  const { command, options } = parseCommandLine(["send", "--site-url", "https://x.org", "--file", "a.md", "--file", "b.md", "--dry-run"]);
  assert.equal(command, "send");
  assert.deepEqual(options.files, ["a.md", "b.md"]);
  assert.equal(options.dryRun, true);
  assert.equal(options.saveSyndication, false);
  assert.equal(options.waitMinutes, 20);
  assert.equal(options.checkEverySeconds, 30);
  assert.equal(options.skipUndated, false, "undated posts are sent by default");
  assert.equal(parseCommandLine(["send", "--site-url", "https://x.org", "--skip-undated"]).options.skipUndated, true);
});

test("--help and no command show the usage", () => {
  assert.equal(parseCommandLine(["--help"]).help, true);
  assert.equal(parseCommandLine([]).help, true);
});

test("mistakes are explained", () => {
  assert.throws(() => parseCommandLine(["post"]), /Unknown command/);
  assert.throws(() => parseCommandLine(["send"]), /--site-url is required/);
  assert.throws(() => parseCommandLine(["send", "--site-url", "x"]), /isn't a web address/);
  assert.throws(() => parseCommandLine(["send", "--site-url", "https://x.org", "--url", "u", "--file", "f"]), /only one of/);
  assert.throws(() => parseCommandLine(["send", "--site-url", "https://x.org", "--added-in-last-days", "0"]), /at least 1/);
  assert.throws(() => parseCommandLine(["send", "--site-url", "https://x.org", "--nope"]), /nope/);
});

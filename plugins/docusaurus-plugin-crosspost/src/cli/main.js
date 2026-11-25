#!/usr/bin/env node
/**
 * Command-line entry point: npx docusaurus-plugin-crosspost <command> ...
 *
 * Run with --help for usage. Uses Node's built-in argument parser.
 * Docs: https://nodejs.org/api/util.html#utilparseargsconfig
 * Tests: test/cli/main.test.js
 */
import { realpathSync } from "node:fs";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { reportError } from "./log.js";
import { send } from "./send.js";

export const USAGE = `Usage: npx docusaurus-plugin-crosspost send --site-url URL [which posts] [options]

Tells Bridgy about new blog posts, so it cross-posts them to Mastodon and
Bluesky. Run it after each deploy, for example from GitHub Actions (see
the plugin's README). The site must be built with docusaurus-plugin-crosspost.

Which posts (pick one; the default is --added-since with no commit, which
means the files added by the current commit):
  --added-since COMMIT       files added since this commit (e.g. a push's "before")
  --added-in-last-days N     files added by commits in the last N days
  --file PATH                this file (repeat for more)
  --url URL                  this live post address

Options:
  --site-url URL             the live site's address, with any base path (required)
  --save-syndication         save the new Mastodon and Bluesky addresses into each post's front matter
  --dry-run                  show what would be sent; send nothing
  --ignore GLOB              also skip posts matching this pattern inside a blog folder (repeatable)
  --wait-minutes N           how long to wait for new posts to go live (default 20)
  --check-every-seconds N    how often to check while waiting (default 30)
  --help                     show this text`;

/** The options the command understands. */
const OPTION_SPEC = {
  "site-url": { type: "string" },
  "added-since": { type: "string" },
  "added-in-last-days": { type: "string" },
  file: { type: "string", multiple: true, default: [] },
  url: { type: "string" },
  ignore: { type: "string", multiple: true, default: [] },
  "save-syndication": { type: "boolean", default: false },
  "dry-run": { type: "boolean", default: false },
  "wait-minutes": { type: "string", default: "20" },
  "check-every-seconds": { type: "string", default: "30" },
  help: { type: "boolean", default: false },
};

/**
 * Reads a whole number from an option.
 *
 * Args:
 *     value: The option's text.
 *     name: The option's name, for the error.
 *     minimum: The smallest allowed value.
 *
 * Returns:
 *     The number.
 *
 * Raises:
 *     Error: If it isn't a whole number of at least minimum.
 */
function wholeNumber(value, name, minimum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum) throw new Error(`--${name} must be a whole number of at least ${minimum}`);
  return number;
}

/**
 * Turns command-line arguments into the send command's options.
 *
 * Args:
 *     argv: The arguments after the program name, e.g. ["send", "--dry-run"].
 *
 * Returns:
 *     { command, help, options }.
 *
 * Raises:
 *     Error: If an option is unknown, missing or wrong, explaining which.
 */
export function parseCommandLine(argv) {
  const { values, positionals } = parseArgs({ args: argv, options: OPTION_SPEC, allowPositionals: true, strict: true });
  const [command] = positionals;
  if (values.help || !command) return { command: command || null, help: true, options: null };
  if (command !== "send") throw new Error(`Unknown command "${command}". The only command is "send".`);

  const which = ["added-since", "added-in-last-days", "url"].filter((name) => values[name] !== undefined);
  if (values.file.length) which.push("file");
  if (which.length > 1) throw new Error(`Use only one of --${which.join(", --")}`);
  if (!values["site-url"]) throw new Error("--site-url is required, e.g. --site-url https://example.com");
  try {
    new URL(values["site-url"]);
  } catch {
    throw new Error(`--site-url "${values["site-url"]}" isn't a web address`);
  }

  return {
    command,
    help: false,
    options: {
      siteUrl: values["site-url"],
      addedSince: values["added-since"] || "",
      addedInLastDays: values["added-in-last-days"] ? wholeNumber(values["added-in-last-days"], "added-in-last-days", 1) : 0,
      files: values.file,
      url: values.url || "",
      ignore: values.ignore,
      saveSyndication: values["save-syndication"],
      dryRun: values["dry-run"],
      waitMinutes: wholeNumber(values["wait-minutes"], "wait-minutes", 0),
      checkEverySeconds: wholeNumber(values["check-every-seconds"], "check-every-seconds", 1),
    },
  };
}

/**
 * Runs the command line.
 *
 * Args:
 *     argv: The arguments after the program name.
 *
 * Returns:
 *     A promise of the exit code.
 */
export async function main(argv) {
  let parsed;
  try {
    parsed = parseCommandLine(argv);
  } catch (error) {
    reportError(error.message);
    console.log(`\n${USAGE}`);
    return 2;
  }
  if (parsed.help) {
    console.log(USAGE);
    return 0;
  }
  return send(parsed.options);
}

/**
 * Tells whether this file was started as a program (not imported by tests).
 * npm starts it through a link in node_modules/.bin, so compare real paths.
 *
 * Returns:
 *     True when run as a program.
 */
function isRunAsProgram() {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (isRunAsProgram()) {
  process.exitCode = await main(process.argv.slice(2));
}

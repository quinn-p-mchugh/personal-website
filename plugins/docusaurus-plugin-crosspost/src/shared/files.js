/**
 * Writing files so nothing ever reads half of one. Runs in Node only.
 *
 * Docusaurus runs every plugin's postBuild step at the same time, and the
 * blog plugin's own postBuild reads post pages to write its RSS and Atom
 * feeds. Writing a page in place could let it read a half-written page.
 * Writing to a temporary file in the same folder and renaming it over the
 * old one replaces the file in one step on every platform Node supports.
 * Docs: https://nodejs.org/api/fs.html#fspromisesrenameoldpath-newpath
 * Tests: test/files.test.js
 */
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Replaces a file's contents in one step.
 *
 * Args:
 *     file: The file's path.
 *     data: The new contents (string or Buffer).
 *
 * Returns:
 *     A promise that resolves once the file holds the new contents.
 */
export async function writeFileSafely(file, data) {
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  try {
    await fs.writeFile(temporary, data);
    await fs.rename(temporary, file);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
}

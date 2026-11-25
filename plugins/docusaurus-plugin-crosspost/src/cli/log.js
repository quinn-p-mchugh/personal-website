/**
 * Prints the "send" command's progress, readably in a terminal and in
 * GitHub Actions logs.
 */

/**
 * Prints a progress line.
 *
 * Args:
 *     message: The line.
 */
export function say(message) {
  console.log(message);
}

/**
 * Prints a problem. In GitHub Actions it also shows on the run's summary.
 * Docs: https://docs.github.com/actions/reference/workflows-and-actions/workflow-commands#setting-an-error-message
 *
 * Args:
 *     message: What went wrong and what to do about it.
 */
export function reportError(message) {
  console.log(process.env.GITHUB_ACTIONS === "true" ? `::error::${message}` : `ERROR: ${message}`);
}

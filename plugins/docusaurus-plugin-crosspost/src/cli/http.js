/**
 * Web requests for the "send" command that never throw, so one network
 * hiccup can't stop a run halfway.
 */

/** Longest wait for one request. */
export const REQUEST_TIMEOUT_MS = 60_000;

/** Identifies the command to the websites it contacts. */
export const USER_AGENT = "docusaurus-plugin-crosspost (+https://www.npmjs.com/package/docusaurus-plugin-crosspost)";

/**
 * Makes a GET request, or a POST with form fields.
 *
 * Args:
 *     url: The address.
 *     form: Form fields to POST; omit for a GET.
 *
 * Returns:
 *     A promise of { status, body, location }: status is 0 when no answer
 *     came (no connection, timeout, bad address), with the reason in body;
 *     location is the Location header, or "".
 */
export async function request(url, form) {
  try {
    const response = await fetch(url, {
      method: form ? "POST" : "GET",
      body: form ? new URLSearchParams(form) : undefined,
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return { status: response.status, body: await response.text(), location: response.headers.get("location") || "" };
  } catch (error) {
    return { status: 0, body: String(error.cause?.message || error.message), location: "" };
  }
}

/**
 * Shortens text for a log line.
 *
 * Args:
 *     text: Any text, e.g. an error page.
 *     limit: The most characters to keep.
 *
 * Returns:
 *     The text on one line, cut with "..." if longer than limit.
 */
export function short(text, limit = 300) {
  const line = String(text).replace(/\s+/g, " ").trim();
  return line.length > limit ? `${line.slice(0, limit)}...` : line;
}

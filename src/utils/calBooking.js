/**
 * Cal.com booking: the shared settings, and opening the booking window.
 * No React here, so it can be used from any component.
 *
 * Cal.com embed docs: https://cal.com/docs/core-features/embed
 */
import { getCalApi } from "@calcom/embed-react";

// The Cal.com event people book (cal.com/quinnm/meet).
export const CAL_LINK = "quinnm/meet";

// The booking page, for links and for when the booking window can't open.
export const BOOKING_PAGE_URL = `https://cal.com/${CAL_LINK}`;

// How long to wait for the booking window before giving up.
const WAIT_FOR_WINDOW_MS = 5000;

// Resolves once Cal.com's booking window (the <cal-modal-box> element) is on
// the page, or rejects after `timeoutMs`. Cal.com queues requests silently
// while its script loads, so the window appearing is the only reliable sign
// that it worked.
function waitForBookingWindow(timeoutMs) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (document.querySelector("cal-modal-box")) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - startedAt > timeoutMs) {
        clearInterval(timer);
        reject(new Error("The Cal.com booking window did not open in time."));
      }
    }, 100);
  });
}

/**
 * Opens the Cal.com booking window over the current page. Loads Cal.com's
 * script the first time it is called.
 *
 * Resolves once the window is open; rejects if it doesn't open within
 * `timeoutMs` (offline, blocked by a privacy extension, too slow), so the
 * caller can fall back to BOOKING_PAGE_URL.
 */
export async function openBookingWindow({ timeoutMs = WAIT_FOR_WINDOW_MS } = {}) {
  const cal = await getCalApi();
  cal("ui", { styles: { branding: { brandColor: "#072957" } } });
  cal("modal", { calLink: CAL_LINK });
  await waitForBookingWindow(timeoutMs);
}

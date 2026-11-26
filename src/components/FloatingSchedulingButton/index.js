import React from "react";
import { HtmlClassNameProvider } from "@docusaurus/theme-common";
import { getCalApi } from "@calcom/embed-react";

import styles from "./styles.module.css";

// Cal.com booking link (cal.com/quinnm/meet), also used on the Contact page.
const CAL_LINK = "quinnm/meet";
const BOOKING_PAGE = `https://cal.com/${CAL_LINK}`;

// How long to wait for Cal.com's booking window before going to the booking
// page instead.
const WAIT_FOR_CAL_MS = 5000;

// Resolves once Cal.com's booking window (<cal-modal-box>) is on the page;
// rejects if it hasn't appeared in time. Cal.com queues requests silently
// while its script loads, so this is the only reliable sign that it worked.
function waitForBookingWindow() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (document.querySelector("cal-modal-box")) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - started > WAIT_FOR_CAL_MS) {
        clearInterval(timer);
        reject(new Error("Cal.com booking window did not open"));
      }
    }, 100);
  });
}

/**
 * A "Book a call" button fixed to the bottom-right corner of the page it is
 * placed on (currently the homepage, src/pages/index.js).
 *
 * It is a normal link to the booking page, so it works without JavaScript and
 * screen readers announce it as a link. When JavaScript is on, clicking it
 * opens Cal.com's booking window over the page instead. Cal.com's script is
 * only loaded on that first click, so the page loads nothing from Cal.com
 * until someone wants to book. If the window doesn't open (offline, blocked
 * by a privacy extension, too slow), it goes to the booking page.
 *
 * Cal.com embed docs: https://cal.com/docs/core-features/embed
 */
export default function FloatingSchedulingButton() {
  async function openBookingWindow(event) {
    // Let Ctrl/Cmd-click, middle-click and similar open the link as usual.
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    try {
      const cal = await getCalApi();
      cal("ui", { styles: { branding: { brandColor: "#072957" } } });
      cal("modal", { calLink: CAL_LINK });
      await waitForBookingWindow();
    } catch {
      window.location.href = BOOKING_PAGE;
    }
  }

  return (
    // Adds a class to <html> (keeping Docusaurus's own), so styles.module.css
    // can leave room for the button on this page only.
    <HtmlClassNameProvider className="has-floating-scheduling-button">
      <a
        className={styles.button}
        href={BOOKING_PAGE}
        onClick={openBookingWindow}
      >
        <svg
          className={styles.icon}
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 11h18" />
        </svg>
        Book a call
      </a>
    </HtmlClassNameProvider>
  );
}

import React, { useRef } from "react";
import clsx from "clsx";

import { BOOKING_PAGE_URL, openBookingWindow } from "@site/src/utils/calBooking";
import styles from "./styles.module.css";

// True for a plain left click. Ctrl/Cmd/Shift/Alt-clicks and middle clicks
// are left to the browser, so "open in new tab" still works.
function isPlainLeftClick(event) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

// Calendar icon. Decorative: the button's text says what it does, so the
// icon is hidden from screen readers.
function CalendarIcon() {
  return (
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
  );
}

/**
 * "Book a call" button that opens the Cal.com booking window.
 *
 * It is a normal link to the booking page styled as a button, so it works
 * without JavaScript and screen readers announce it as a link. With
 * JavaScript, a click opens the booking window over the page instead; if the
 * window can't open, it goes to the booking page.
 *
 * Accessibility: white on navy (14:1 contrast), at least 48px tall, visible
 * keyboard focus ring.
 *
 * @param {object} props
 * @param {string} [props.className] Extra classes, e.g. for positioning.
 * @param {React.ReactNode} [props.children] Button text.
 */
export default function BookCallButton({ className, children = "Book a call" }) {
  // Ignores repeat clicks while the booking window is opening.
  const isOpening = useRef(false);

  async function handleClick(event) {
    if (!isPlainLeftClick(event)) return;
    event.preventDefault();
    if (isOpening.current) return;

    isOpening.current = true;
    try {
      await openBookingWindow();
    } catch {
      window.location.assign(BOOKING_PAGE_URL);
    } finally {
      isOpening.current = false;
    }
  }

  return (
    <a
      className={clsx(styles.button, className)}
      href={BOOKING_PAGE_URL}
      onClick={handleClick}
    >
      <CalendarIcon />
      {children}
    </a>
  );
}

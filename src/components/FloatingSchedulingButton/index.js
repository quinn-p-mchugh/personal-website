import React from "react";
import { HtmlClassNameProvider } from "@docusaurus/theme-common";

import BookCallButton from "@site/src/components/BookCallButton";
import styles from "./styles.module.css";

/**
 * The "Book a call" button, fixed to the bottom-right corner of the page.
 * Used on the homepage (src/pages/index.js).
 *
 * This component only handles placement; the button itself is
 * BookCallButton.
 */
export default function FloatingSchedulingButton() {
  return (
    // Adds a class to <html> for this page only (keeping Docusaurus's own
    // classes), so styles.module.css can leave room for the button.
    <HtmlClassNameProvider className={styles.pageWithFloatingButton}>
      <BookCallButton className={styles.floating} />
    </HtmlClassNameProvider>
  );
}

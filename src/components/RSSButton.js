import React from "react";
import { useLocation } from "@docusaurus/router";

// Link to the current blog's feed. A plain link styled as a button (not a
// <button> inside a link, which screen readers and keyboards handle badly).
export default function RSSButton() {
  const location = useLocation();
  const blogSlug = location.pathname.split("/")[1];
  const rssUrl = `/${blogSlug}/atom.xml`;

  return (
    <a href={rssUrl} className="rss-button">
      RSS<span className="sr-only"> feed</span>
    </a>
  );
}

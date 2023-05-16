import React from "react";
import { useLocation } from "@docusaurus/router";

export default function RSSButton() {
  const location = useLocation();
  const blogSlug = location.pathname.split("/")[1];
  const rssUrl = `/${blogSlug}/rss.xml`;

  return (
    <a href={rssUrl}>
      <button>RSS</button>
    </a>
  );
}

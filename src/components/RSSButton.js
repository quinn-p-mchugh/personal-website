import React from "react";
import { useLocation } from "@docusaurus/router";
import { Link } from "react-router-dom";

export default function RSSButton() {
  const location = useLocation();
  const rssUrl = `${location.pathname}/rss.xml`;

  return (
    <Link to={rssUrl}>
      <button>RSS</button>
    </Link>
  );
}

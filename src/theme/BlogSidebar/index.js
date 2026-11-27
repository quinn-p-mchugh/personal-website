import React from "react";
import BlogSidebar from "@theme-original/BlogSidebar";

import RSSButton from "@site/src/components/RSSButton";

export default function BlogSidebarWrapper(props) {
  // A blog with no posts has no feed, so its RSS button would lead nowhere.
  const hasPosts = props.sidebar?.items?.length > 0;
  return (
    <>
      {hasPosts && <RSSButton />}
      <BlogSidebar {...props} />
    </>
  );
}

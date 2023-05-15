import React from "react";
import BlogSidebar from "@theme-original/BlogSidebar";

import RSSButton from "@site/src/components/RSSButton";

export default function BlogSidebarWrapper(props) {
  return (
    <>
      <RSSButton />
      <BlogSidebar {...props} />
    </>
  );
}

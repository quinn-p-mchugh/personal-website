import React from "react";
import clsx from "clsx";
import { blogPostContainerID } from "@docusaurus/utils-common";
import { useBlogPost } from "@docusaurus/theme-common/internal";
import MDXContent from "@theme/MDXContent";

import GiscusComponent from "@site/src/components/GiscusComponent";

export default function BlogPostItemContent({ children, className }) {
  const { isBlogPostPage } = useBlogPost();
  return (
    <div
      // This ID is used for the feed generation to locate the main content
      id={isBlogPostPage ? blogPostContainerID : undefined}
      className={clsx("markdown", className)}
      itemProp="articleBody"
    >
      <MDXContent>
        {children}
        {isBlogPostPage && <GiscusComponent />}
      </MDXContent>
    </div>
  );
}

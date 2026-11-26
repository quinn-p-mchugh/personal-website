import React from "react";
import MDXComponents from "@theme-original/MDXComponents";

/**
 * Adds to the components Docusaurus uses for Markdown.
 * Docs: https://docusaurus.io/docs/markdown-features/react#mdx-component-scope
 *
 * Task lists ("- [x] Goal") render as read-only checkboxes with no label, so a
 * screen reader announces only "checkbox, checked". Naming them "Completed"
 * makes it "Completed, checkbox, checked", with the goal's text right after.
 */
function Input(props) {
  if (props.type === "checkbox") {
    return <input aria-label="Completed" {...props} />;
  }
  return <input {...props} />;
}

export default {
  ...MDXComponents,
  input: Input,
};

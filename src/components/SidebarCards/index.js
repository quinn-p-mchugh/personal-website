import React from "react";
import DocCardList from "@theme/DocCardList";
import { useDoc, useDocsSidebar } from "@docusaurus/plugin-content-docs/client";

/**
 * A card for every page and category in the current sidebar, except the page
 * it's placed on. Use it on a section's overview page: the cards update on
 * their own as pages are added, renamed or hidden.
 *
 * Usage in a .md or .mdx page:
 *   import SidebarCards from "@site/src/components/SidebarCards";
 *   <SidebarCards />
 *
 * Docs: https://docusaurus.io/docs/sidebar/items#embedding-generated-index
 */
export default function SidebarCards() {
  const sidebar = useDocsSidebar();
  const { metadata } = useDoc();
  const items = (sidebar?.items ?? []).filter(
    (item) => !(item.type === "link" && item.docId === metadata.id),
  );
  return <DocCardList items={items} />;
}

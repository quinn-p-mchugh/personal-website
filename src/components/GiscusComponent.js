import React from "react";
import Giscus from "@giscus/react";
import { useColorMode } from "@docusaurus/theme-common";
import { useLocation } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";

export default function GiscusComponent() {
  const { colorMode } = useColorMode();
  const location = useLocation();
  const { siteConfig } = useDocusaurusContext();
  const { forbiddenGiscusPaths } = siteConfig.customFields;
  const giscusComponent = (
    <Giscus
      id="comments"
      repo="quinn-p-mchugh/personal-website"
      repoId="R_kgDOIYZ3OQ"
      category="Announcements"
      categoryId="DIC_kwDOIYZ3Oc4CWcmr"
      mapping="pathname"
      strict="0"
      reactionsEnabled="1"
      emitMetadata="0"
      inputPosition="top"
      theme={colorMode}
      lang="en"
      loading="lazy"
    />
  );
  return (
    <React.Fragment>
      <hr />
      <br></br>
      {!forbiddenGiscusPaths.includes(location.pathname) && giscusComponent}
    </React.Fragment>
  );
}

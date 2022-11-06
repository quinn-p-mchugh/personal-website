// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("prism-react-renderer/themes/github");
const darkCodeTheme = require("prism-react-renderer/themes/dracula");

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Quinn McHugh",
  tagline: "Engineer. Designer. Developer.",
  url: "https://quinnmchugh.net",
  baseUrl: "/",
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",
  favicon: "img/favicon.ico",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "quinn-p-mchugh", // Usually your GitHub org/user name.
  projectName: "personal-website", // Usually your repo name.

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl: "https://github.com/quinn-p-mchugh/personal-website",
        },
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl: "https://github.com/quinn-p-mchugh/personal-website",
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
        pages: {},
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: "",
        logo: {
          alt: "My Site Logo",
          src: "img/logo.svg",
        },
        items: [
          {
            type: "doc",
            docId: "welcome",
            position: "left",
            label: "Tutorial",
          },
          { to: "/blog", label: "Blog", position: "left" },
          {
            href: "https://www.linkedin.com/in/quinnpmchugh/",
            position: "right",
            className: "header-linkedin-link",
            "aria-label": "LinkedIn Profile",
          },
          {
            href: "https://github.com/quinn-p-mchugh",
            position: "right",
            className: "header-github-link",
            "aria-label": "GitHub Profile",
          },
          {
            href: "https://www.instagram.com/qm_creative/",
            position: "right",
            className: "header-insta-link",
            "aria-label": "Instagram Profile",
          },
          {
            href: "https://www.polarsteps.com/QuinnPMcHugh",
            position: "right",
            className: "header-bicycle-link",
            "aria-label": "Polarsteps Profile",
          },
        ],
      },
      footer: {
        style: "dark",
        links: [
          {
            title: "More",
            items: [
              {
                label: "Blog",
                to: "/blog",
              },
              {
                label: "Projects",
                to: "/docs/welcome",
              },
            ],
          },
          {
            title: "Quinn on the net",
            items: [
              {
                label: "LinkedIn",
                href: "https://www.linkedin.com/in/quinnpmchugh/",
              },
              {
                label: "GitHub",
                href: "https://github.com/quinn-p-mchugh",
              },
              {
                label: "Instagram",
                href: "https://www.instagram.com/qm_creative/",
              },
              {
                label: "Bicycle Travels",
                href: "https://www.polarsteps.com/QuinnPMcHugh",
              },
            ],
          },
        ],
        copyright: `Copyright © 2017-${new Date().getFullYear()} Quinn McHugh. All rights reserved.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;

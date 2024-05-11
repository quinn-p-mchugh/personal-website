// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

//import remarkRehype from 'remark-rehype';
//import remarkRetext from 'remark-retext';
import remarkLint from "remark-lint";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
//import remarkGithub from 'remark-github';
import remarkMath from "remark-math";
//import remarkFrontmatter from 'remark-frontmatter';
import remarkA11yEmoji from "@fec/remark-a11y-emoji";
//import remarkCodeTitle from 'remark-code-title';
import remarkCodeSandbox from "remark-codesandbox";
import remarkCopyLinkedFiles from "remark-copy-linked-files";
import remarkDefinitionList from "remark-definition-list";
import remarkFlexibleCodeTitles from "remark-flexible-code-titles";
import remarkWikiLinkPlus from "remark-wiki-link-plus";
//import remarkPresetLintRetextEnglish from 'remark-preset-lint-retext-english';
import remarkValidateLinks from "remark-validate-links";
import remarkPrism from "remark-prism";
import tailwindPlugin from "./plugins/tailwind.config.cjs";

//import rehypeRemark from 'rehype-remark'
//import rehypeRetext from 'rehype-retext';

const { themes } = require("prism-react-renderer");
const lightCodeTheme = themes.github;
const darkCodeTheme = themes.dracula;

const plugins = {
  remarkPlugins: [
    //[remarkRehype, {}],             // https://github.com/remarkjs/remark-rehype?tab=readme-ov-file#options
    //[remarkRetext, {}],             // https://github.com/remarkjs/remark-retext?tab=readme-ov-file#options
    [remarkLint, {}], // https://github.com/remarkjs/remark-lint
    //[remarkToc, {}],                // https://github.com/remarkjs/remark-toc?tab=readme-ov-file#fields
    [remarkGfm, {}], // https://github.com/remarkjs/remark-gfm?tab=readme-ov-file#options
    [remarkMdx, {}], // https://github.com/mdx-js/mdx/tree/main/packages/remark-mdx#options
    //[remarkGithub, {}],           // https://github.com/remarkjs/remark-github?tab=readme-ov-file#options
    [remarkMath, {}], // https://github.com/remarkjs/remark-math
    //[remarkFrontmatter, {}],        // https://github.com/remarkjs/remark-frontmatter?tab=readme-ov-file#options
    [remarkA11yEmoji, {}], // https://github.com/remarkjs/remark-frontmatter?tab=readme-ov-file#options
    //[remarkCodeTitle, {}],        // https://github.com/remarkjs/remark-frontmatter?tab=readme-ov-file#options
    [remarkCodeSandbox, {}], // https://github.com/kevin940726/remark-codesandbox?tab=readme-ov-file#options
    [remarkCopyLinkedFiles, {}], // https://github.com/sergioramos/remark-copy-linked-files
    [remarkDefinitionList, {}], // https://github.com/wataru-chocola/remark-definition-list
    [remarkFlexibleCodeTitles, {}], // https://github.com/ipikuka/remark-flexible-code-titles?tab=readme-ov-file#options
    [remarkWikiLinkPlus, {}], // https://github.com/datopian/remark-wiki-link-plus?tab=readme-ov-file#configuration-options
    //[remarkPresetLintRetextEnglish, {}],  // https://github.com/keplersj/remark-preset-lint-retext-english
    [
      remarkValidateLinks,
      { repository: "https://github.com/quinn-p-mchugh/personal-website" },
    ], // https://github.com/remarkjs/remark-validate-links?tab=readme-ov-file#options
    [remarkPrism, {}], // https://github.com/sergioramos/remark-prism?tab=readme-ov-file
  ],
  rehypePlugins: [],
};

// https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog
const blogConfig = {
  blog: {
    title: "Quinn McHugh's Blog",
    description: "The blog of Quinn McHugh",
  },
  microBlog: {
    title: "Quinn McHugh's Micro Blog",
    description:
      "A microblog of miscellaneous musings, tips, and thoughts from Quinn McHugh",
  },
  ideasBlog: {
    title: "Quinn McHugh's Idea Feed",
    description:
      "Half-baked, outlandish, and occasionally good ideas from Quinn McHugh",
  },
  sidebarCount: "ALL",
  feedType: "all",
  feedLimit: 100,
  copyright: `Copyright © 2017-${new Date().getFullYear()} Quinn McHugh`,
};

const docsConfig = {
  projects: {
    linkId: "ea-explorer",
  },
};

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Quinn McHugh",
  tagline: "Engineer. Designer. Developer.",
  customFields: {
    forbiddenGiscusPaths: [], // See GiscusComponent.js - Example: "/docs/tutorials/intro"
  },
  url: "https://quinnmchugh.net",
  baseUrl: "/",
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",
  favicon: "img/favicon.ico",
  markdown: {
    mermaid: true,
  },

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

  plugins: [
    tailwindPlugin,
    ["drawio", {}],
    [
      "@docusaurus/plugin-content-docs",
      {
        id: "projects",
        path: "docs-projects",
        routeBasePath: "projects",
        //sidebarPath: require.resolve("./sidebarsProjects.js"),
      },
    ],
    [
      '@docusaurus/plugin-content-blog',
      {
        /**
         * Required for any multi-instance plugin
         */
        id: "blog-ideas",
        /**
         * URL route for the blog section of your site.
         * *DO NOT* include a trailing slash.
         */
        routeBasePath: "ideas",
        /**
         * Path to data on filesystem relative to site dir.
         */
        path: "blog-ideas",
        blogTitle: blogConfig.ideasBlog.title,
        blogDescription: blogConfig.ideasBlog.description,
        blogSidebarTitle: "Half-baked, outlandish, and occasionally good ideas for someone else to execute",
        blogSidebarCount: blogConfig.sidebarCount,
        showReadingTime: false,
        feedOptions: {
          title: blogConfig.ideasBlog.title,
          description: blogConfig.ideasBlog.description,
          type: blogConfig.feedType,
          copyright: blogConfig.copyright,
          limit: blogConfig.feedLimit,
        },
        remarkPlugins: plugins.remarkPlugins,
        rehypePlugins: plugins.rehypePlugins,
      },
    ],
    [
      "@docusaurus/plugin-content-blog",
      {
        /**
         * Required for any multi-instance plugin
         */
        id: "blog-micro",
        /**
         * URL route for the blog section of your site.
         * *DO NOT* include a trailing slash.
         */
        routeBasePath: "blog-micro",
        /**
         * Path to data on filesystem relative to site dir.
         */
        path: "blog-micro",
        blogTitle: blogConfig.microBlog.title,
        blogDescription: blogConfig.microBlog.description,
        blogSidebarTitle: "My Microblog: Miscellaneous musings, fleeting thoughts, & unsolicited advice",
        blogSidebarCount: blogConfig.sidebarCount,
        showReadingTime: false,
        feedOptions: {
          title: blogConfig.microBlog.title,
          description: blogConfig.microBlog.description,
          type: blogConfig.feedType,
          copyright: blogConfig.copyright,
          limit: blogConfig.feedLimit,
        },
        remarkPlugins: plugins.remarkPlugins,
        rehypePlugins: plugins.rehypePlugins,
      },
    ],
  ],

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          id: "docs",
          path: "docs",
          routeBasePath: "docs",
          showLastUpdateTime: true,
          remarkPlugins: plugins.remarkPlugins,
          rehypePlugins: plugins.rehypePlugins,
        },
        blog: {
          id: "blog",
          path: "blog",
          routeBasePath: "blog",
          blogTitle: blogConfig.blog.title,
          blogDescription: blogConfig.blog.description,
          blogSidebarTitle: "New posts, hot off the press:",
          blogSidebarCount: blogConfig.sidebarCount,
          showReadingTime: true,
          feedOptions: {
            title: blogConfig.blog.title,
            description: blogConfig.blog.description,
            type: blogConfig.feedType,
            copyright: blogConfig.copyright,
            limit: blogConfig.feedLimit,
          },
        },
        theme: {
          customCss: [require.resolve("./src/css/custom.css")],
        },
        pages: {},
        gtag: {
          trackingID: ["G-WSVD3SVT4R", "UA-121689368-1"],
          anonymizeIP: true,
        },
      }),
    ],
  ],

  themes: ["@docusaurus/theme-mermaid"],

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
            label: "Resume",
            to: "/resume",
          },
          {
            label: "Projects",
            to: `/projects/${docsConfig.projects.linkId}`,
            position: "left",
          },
          {
            label: "Now",
            to: `/now`,
            position: "left",
          },
          {
            type: "dropdown",
            label: "Notes & Resources",
            position: "left",
            items: [
              {
                label: "Docs",
                to: "/docs/welcome",
              },
              {
                label: "Highlights",
                href: "https://readwise.io/@quinnmchugh",
              },
              {
                label: "Digital Garden",
                href: "https://notes.quinnmchugh.net/",
              },
              {
                label: "Resource Library",
                to: "/library",
              },
            ],
          },
          {
            type: "dropdown",
            label: "Blogs",
            position: "left",
            items: [
              { to: "/blog", label: "Blog" },
              { to: "/blog-micro", label: "Microblog" },
              { to: "/ideas", label: "Ideas" },
            ],
          },
          {
            type: "dropdown",
            label: "About",
            position: "left",
            items: [
              {
                label: "Books",
                to: "/books",
              },
              {
                label: "Travels",
                to: "/travels",
              },
            ],
          },
          {
            label: "Feedback",
            href: "https://forms.gle/A1DB5tpmA8PtywZaA",
          },
          {
            label: "Contact",
            to: "/contact",
          },
          {
            href: "https://www.linkedin.com/in/quinnpmchugh/",
            position: "right",
            className: "navbar-icon",
            "aria-label": "LinkedIn Profile",
            html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 5 1036 990"><path d="M0 120c0-33.334 11.667-60.834 35-82.5C58.333 15.833 88.667 5 126 5c36.667 0 66.333 10.666 89 32 23.333 22 35 50.666 35 86 0 32-11.333 58.666-34 80-23.333 22-54 33-92 33h-1c-36.667 0-66.333-11-89-33S0 153.333 0 120zm13 875V327h222v668H13zm345 0h222V622c0-23.334 2.667-41.334 8-54 9.333-22.667 23.5-41.834 42.5-57.5 19-15.667 42.833-23.5 71.5-23.5 74.667 0 112 50.333 112 151v357h222V612c0-98.667-23.333-173.5-70-224.5S857.667 311 781 311c-86 0-153 37-201 111v2h-1l1-2v-95H358c1.333 21.333 2 87.666 2 199 0 111.333-.667 267.666-2 469z"/></svg>`,
          },
          {
            href: "https://github.com/quinn-p-mchugh",
            position: "right",
            className: "navbar-icon",
            "aria-label": "GitHub Profile",
            html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>`,
          },
          {
            href: "https://www.instagram.com/qm_creative/",
            position: "right",
            className: "navbar-icon",
            "aria-label": "Instagram Profile",
            html: `<svg viewBox="0 0 2476 2476" xmlns="http://www.w3.org/2000/svg"><path d="M825.4 1238c0-227.9 184.7-412.7 412.6-412.7 227.9 0 412.7 184.8 412.7 412.7 0 227.9-184.8 412.7-412.7 412.7-227.9 0-412.6-184.8-412.6-412.7m-223.1 0c0 351.1 284.6 635.7 635.7 635.7s635.7-284.6 635.7-635.7-284.6-635.7-635.7-635.7S602.3 886.9 602.3 1238m1148-660.9c0 82 66.5 148.6 148.6 148.6 82 0 148.6-66.6 148.6-148.6s-66.5-148.5-148.6-148.5-148.6 66.5-148.6 148.5M737.8 2245.7c-120.7-5.5-186.3-25.6-229.9-42.6-57.8-22.5-99-49.3-142.4-92.6-43.3-43.3-70.2-84.5-92.6-142.3-17-43.6-37.1-109.2-42.6-229.9-6-130.5-7.2-169.7-7.2-500.3s1.3-369.7 7.2-500.3c5.5-120.7 25.7-186.2 42.6-229.9 22.5-57.8 49.3-99 92.6-142.4 43.3-43.3 84.5-70.2 142.4-92.6 43.6-17 109.2-37.1 229.9-42.6 130.5-6 169.7-7.2 500.2-7.2 330.6 0 369.7 1.3 500.3 7.2 120.7 5.5 186.2 25.7 229.9 42.6 57.8 22.4 99 49.3 142.4 92.6 43.3 43.3 70.1 84.6 92.6 142.4 17 43.6 37.1 109.2 42.6 229.9 6 130.6 7.2 169.7 7.2 500.3 0 330.5-1.2 369.7-7.2 500.3-5.5 120.7-25.7 186.3-42.6 229.9-22.5 57.8-49.3 99-92.6 142.3-43.3 43.3-84.6 70.1-142.4 92.6-43.6 17-109.2 37.1-229.9 42.6-130.5 6-169.7 7.2-500.3 7.2-330.5 0-369.7-1.2-500.2-7.2M727.6 7.5c-131.8 6-221.8 26.9-300.5 57.5-81.4 31.6-150.4 74-219.3 142.8C139 276.6 96.6 345.6 65 427.1 34.4 505.8 13.5 595.8 7.5 727.6 1.4 859.6 0 901.8 0 1238s1.4 378.4 7.5 510.4c6 131.8 26.9 221.8 57.5 300.5 31.6 81.4 73.9 150.5 142.8 219.3 68.8 68.8 137.8 111.1 219.3 142.8 78.8 30.6 168.7 51.5 300.5 57.5 132.1 6 174.2 7.5 510.4 7.5 336.3 0 378.4-1.4 510.4-7.5 131.8-6 221.8-26.9 300.5-57.5 81.4-31.7 150.4-74 219.3-142.8 68.8-68.8 111.1-137.9 142.8-219.3 30.6-78.7 51.6-168.7 57.5-300.5 6-132.1 7.4-174.2 7.4-510.4s-1.4-378.4-7.4-510.4c-6-131.8-26.9-221.8-57.5-300.5-31.7-81.4-74-150.4-142.8-219.3C2199.4 139 2130.3 96.6 2049 65c-78.8-30.6-168.8-51.6-300.5-57.5-132-6-174.2-7.5-510.4-7.5-336.3 0-378.4 1.4-510.5 7.5"/></svg>`,
          },
          {
            href: "https://www.polarsteps.com/QuinnPMcHugh",
            position: "right",
            className: "navbar-icon",
            "aria-label": "Polarsteps Profile",
            html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><!--! Font Awesome Pro 6.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M312 32c-13.3 0-24 10.7-24 24s10.7 24 24 24h25.7l34.6 64H222.9l-27.4-38C191 99.7 183.7 96 176 96H120c-13.3 0-24 10.7-24 24s10.7 24 24 24h43.7l22.1 30.7-26.6 53.1c-10-2.5-20.5-3.8-31.2-3.8C57.3 224 0 281.3 0 352s57.3 128 128 128c65.3 0 119.1-48.9 127-112h49c8.5 0 16.3-4.5 20.7-11.8l84.8-143.5 21.7 40.1C402.4 276.3 384 312 384 352c0 70.7 57.3 128 128 128s128-57.3 128-128s-57.3-128-128-128c-13.5 0-26.5 2.1-38.7 6L375.4 48.8C369.8 38.4 359 32 347.2 32H312zM458.6 303.7l32.3 59.7c6.3 11.7 20.9 16 32.5 9.7s16-20.9 9.7-32.5l-32.3-59.7c3.6-.6 7.4-.9 11.2-.9c39.8 0 72 32.2 72 72s-32.2 72-72 72s-72-32.2-72-72c0-18.6 7-35.5 18.6-48.3zM133.2 368h65c-7.3 32.1-36 56-70.2 56c-39.8 0-72-32.2-72-72s32.2-72 72-72c1.7 0 3.4 .1 5.1 .2l-24.2 48.5c-9 18.1 4.1 39.4 24.3 39.4zm33.7-48l50.7-101.3 72.9 101.2-.1 .1H166.8zm90.6-128H365.9L317 274.8 257.4 192z"/></svg>`,
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
                to: `/projects/${docsConfig.projects.linkId}`,
              },
              {
                label: "My Library",
                to: "/library",
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
          {
            title: "Support my work",
            items: [
              {
                html: `<a href="https://ko-fi.com/quinnmchugh" rel="noopener" target="_blank">
                  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" loading="lazy" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;">
                </a>
                <br>
                <b>Found something of value here?</b> Consider buying me a coffee to say thanks and support my work. ☕
                <br>50% of donations go to <a href="https://www.givewell.org/top-charities-fund">GiveWell's Top Charities Fund</a>.`,
              },
            ],
          },
        ],
        copyright: `Copyright © 2017-${new Date().getFullYear()} Quinn McHugh. All rights reserved.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
        additionalLanguages: [
          "markup",
          "bash",
          "css",
          "css-extras",
          "javascript",
          "jsx",
          "js-extras",
          "js-templates",
          "diff",
          "git",
          "graphql",
          "markup-templating",
          "json",
          "makefile",
          "markdown",
          "python",
          "sql",
          "tsx",
          "typescript",
          "yaml",
        ],
      },
      colorMode: {
        defaultMode: "light",
        disableSwitch: true,
      },
      algolia: {
        // The application ID provided by Algolia
        appId: "WBC66M4D3R",

        // Public API key: it is safe to commit it
        apiKey: "e07735a120eff404cd7d9df5033dec6c",

        indexName: "quinnmchugh",

        // Optional: see doc section below
        contextualSearch: true,

        // Optional: Specify domains where the navigation should occur through window.location instead on history.push. Useful when our Algolia config crawls multiple documentation sites and we want to navigate with window.location.href to them.
        externalUrlRegex: "quinnmchugh\\.net",

        // Optional: Replace parts of the item URLs from Algolia. Useful when using the same search index for multiple deployments using a different baseUrl. You can use regexp or string in the `from` param. For example: localhost:3000 vs myCompany.com/docs
        replaceSearchResultPathname: {
          from: "/docs/", // or as RegExp: /\/docs\//
          to: "/",
        },

        // Optional: Algolia search parameters
        searchParameters: {},

        // Optional: path for search page that enabled by default (`false` to disable it)
        searchPagePath: "search",

        //... other Algolia params
      },
      zoom: {
        selector: ".markdown > img",
        background: {
          light: "rgb(255, 255, 255)",
          dark: "rgb(50, 50, 50)",
        },
        config: {
          // options you can specify via https://github.com/francoischalifour/medium-zoom?tab=readme-ov-file#options
        },
      },
    }),
};

module.exports = config;

// Accessibility check for every page of the site.
//
// For each page in build/sitemap.xml, and at each screen size in
// playwright.config.js, this opens the page and runs axe-core
// (https://github.com/dequelabs/axe-core), which tests it against the WCAG
// 2.0, 2.1 and 2.2 level A and AA rules that can be checked automatically.
// It also opens the phone menu and checks that.
//
// A failure lists each problem, the elements it was found on, and a link to
// Deque's explanation of how to fix it.
//
// Automated checks find roughly a third of accessibility problems; the rest
// (does the alt text make sense? can you use the site with a keyboard?)
// still need a person.
//
// axe for Playwright docs: https://github.com/dequelabs/axe-core-npm/blob/develop/packages/playwright/README.md

const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { AxeBuilder } = require("@axe-core/playwright");

const { blockOutsideRequests } = require("./helpers");

// The WCAG rule sets to check: levels A and AA of WCAG 2.0, 2.1 and 2.2.
// Docs: https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#axe-core-tags
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// Problems we know about but can't fix in this repository. Each needs a rule
// id, a CSS class that the affected element has, and the reason. Keep this
// short.
const KNOWN_ISSUES = [
  {
    rule: "label-content-name-mismatch",
    className: "DocSearch-Button",
    reason:
      "Algolia's search button is named \"Search\" but also shows the Ctrl K " +
      "shortcut. It comes from Algolia's DocSearch package, not this site.",
  },
];

// Every page of the built site, read from its sitemap, as paths like "/now".
function pagesFromSitemap() {
  const sitemapPath = path.join(__dirname, "..", "..", "build", "sitemap.xml");
  if (!fs.existsSync(sitemapPath)) {
    throw new Error(
      "build/sitemap.xml not found. Build the site first with: npm run build",
    );
  }
  const xml = fs.readFileSync(sitemapPath, "utf8");
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  return urls.map((url) => new URL(url).pathname);
}

// True if the element's opening tag has the given class.
function hasClass(html, className) {
  const classes = html.match(/^<[^>]*\bclass="([^"]*)"/)?.[1] ?? "";
  return classes.split(/\s+/).includes(className);
}

// Runs axe on the page and returns the problems found, minus KNOWN_ISSUES.
async function findProblems(page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations
    .map((violation) => {
      const known = KNOWN_ISSUES.filter((k) => k.rule === violation.id);
      // node.html is the start of the element's HTML, e.g.
      // <button class="DocSearch DocSearch-Button" ...>
      const nodes = violation.nodes.filter(
        (node) => !known.some((k) => hasClass(node.html, k.className)),
      );
      return { ...violation, nodes };
    })
    .filter((violation) => violation.nodes.length > 0);
}

// Turns axe's results into a message a person can act on.
function describe(problems) {
  return problems
    .map((p) => {
      const where = p.nodes
        .slice(0, 5)
        .map((node) => `      - ${node.target.join(" ")}`)
        .join("\n");
      const more = p.nodes.length > 5 ? `\n      - ...and ${p.nodes.length - 5} more` : "";
      return `  ${p.id} (${p.impact}): ${p.help}\n    How to fix: ${p.helpUrl}\n    Found on:\n${where}${more}`;
    })
    .join("\n\n");
}

for (const pagePath of pagesFromSitemap()) {
  test(`${pagePath} has no accessibility problems`, async ({ page, baseURL }) => {
    await blockOutsideRequests(page, baseURL);
    await page.goto(pagePath);

    const problems = await findProblems(page);
    expect(problems.length, `Accessibility problems on ${pagePath}:\n\n${describe(problems)}\n`).toBe(0);
  });
}

test("the phone menu has no accessibility problems", async ({ page, baseURL, isMobile }) => {
  test.skip(!isMobile, "The menu button only shows on small screens.");
  await blockOutsideRequests(page, baseURL);
  await page.goto("/");

  await page.getByRole("button", { name: "Toggle navigation bar" }).click();
  await expect(page.locator(".navbar-sidebar")).toBeVisible();

  const problems = await findProblems(page);
  expect(problems.length, `Accessibility problems in the phone menu:\n\n${describe(problems)}\n`).toBe(0);
});

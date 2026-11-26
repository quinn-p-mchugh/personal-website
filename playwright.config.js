// Settings for the browser checks of the built site (tests/browser/):
//   - accessibility.spec.js: every page, checked with axe-core, the
//     accessibility checker by Deque, at a desktop and a phone screen size.
//   - book-call-button.spec.js: the homepage's "Book a call" button.
//
// They run on GitHub for every pull request
// (.github/workflows/check-site.yml).
//
// Run them locally:
//   npm run build                         (makes the site in build/)
//   npx playwright install chromium       (first time only: the browser)
//   npm run test:site
//
// Playwright docs: https://playwright.dev/docs/test-configuration

const { defineConfig, devices } = require("@playwright/test");

// The port the built site is served on while testing. Any free port works.
// Docs: https://docusaurus.io/docs/cli#docusaurus-serve-sitedir
const PORT = 3310;

module.exports = defineConfig({
  // Where the checks live.
  testDir: "./tests/browser",

  // Check pages side by side to save time.
  // Docs: https://playwright.dev/docs/test-parallel
  fullyParallel: true,

  // In GitHub Actions: no retries, since an accessibility problem is not
  // flaky, and a short list of failures in the log plus a full report.
  // Docs: https://playwright.dev/docs/test-reporters
  retries: 0,
  reporter: process.env.CI
    ? [["github"], ["list"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: `http://localhost:${PORT}`,
  },

  // Two screen sizes: a laptop and a phone. Both use Chromium, Chrome's
  // open-source engine.
  // Docs: https://playwright.dev/docs/test-projects
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],

  // Serve the already-built site (build/) before the checks start.
  // Docs: https://playwright.dev/docs/test-webserver
  webServer: {
    command: `npx docusaurus serve --port ${PORT} --no-open`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

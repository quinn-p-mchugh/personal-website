// Checks the homepage's "Book a call" button
// (src/components/FloatingSchedulingButton and BookCallButton).
//
// Cal.com is blocked here (see helpers.js), so these checks cover the parts
// this site controls: where the button shows, where it links, and what
// happens when Cal.com's booking window can't open. Its accessibility is
// covered by accessibility.spec.js, which checks the homepage.

const { test, expect } = require("@playwright/test");
const { blockOutsideRequests } = require("./helpers");

const BOOKING_PAGE_URL = "https://cal.com/quinnm/meet";

test("the homepage shows one Book a call button that links to the booking page", async ({ page, baseURL }) => {
  await blockOutsideRequests(page, baseURL);
  await page.goto("/");

  const button = page.getByRole("link", { name: "Book a call" });
  await expect(button).toHaveCount(1);
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute("href", BOOKING_PAGE_URL);
});

test("other pages don't show the Book a call button", async ({ page, baseURL }) => {
  await blockOutsideRequests(page, baseURL);
  await page.goto("/now");

  await expect(page.getByRole("link", { name: "Book a call" })).toHaveCount(0);
});

test("the button goes to the booking page when Cal.com can't load", async ({ page, baseURL }) => {
  await blockOutsideRequests(page, baseURL);
  await page.goto("/");

  // Cal.com's script is blocked, so the booking window never opens; after
  // about 5 seconds the button should send the visitor to the booking page.
  const goesToBookingPage = page.waitForRequest(
    (request) => request.url().startsWith(BOOKING_PAGE_URL) && request.isNavigationRequest(),
    { timeout: 10_000 },
  );
  await page.getByRole("link", { name: "Book a call" }).click();
  await goesToBookingPage;
});

test("the button doesn't cover the end of the page", async ({ page, baseURL }) => {
  await blockOutsideRequests(page, baseURL);
  await page.goto("/");

  // Load every photo now (normally they load as you scroll to them), so the
  // page has its final height, then scroll to the bottom.
  await page.evaluate(() => {
    for (const image of document.images) image.loading = "eager";
  });
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  const buttonTop = (await page.getByRole("link", { name: "Book a call" }).boundingBox()).y;
  const footerTextBottom = await page.evaluate(() =>
    Math.max(
      ...[...document.querySelectorAll(".footer a, .footer__copyright")].map(
        (element) => element.getBoundingClientRect().bottom,
      ),
    ),
  );
  expect(footerTextBottom).toBeLessThanOrEqual(buttonTop);
});

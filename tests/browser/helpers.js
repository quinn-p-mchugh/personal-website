// Shared helpers for the browser checks.

/**
 * Only lets the page load files from the local copy of the site. Outside
 * services (Google Fonts, analytics, Google Drive and map embeds, comments,
 * Cal.com) are blocked, so results don't depend on them being up, and their
 * own problems, which this site can't fix, aren't counted.
 *
 * Returns a list that fills with the outside addresses the page tried to
 * load, for checks that need to know.
 */
async function blockOutsideRequests(page, baseURL) {
  const blocked = [];
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(baseURL)) return route.continue();
    blocked.push(url);
    return route.abort();
  });
  return blocked;
}

module.exports = { blockOutsideRequests };

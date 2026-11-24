#!/usr/bin/env python3
"""
Send new blog posts to Bridgy so it cross-posts them to Mastodon and Bluesky.

What this does, in plain terms
------------------------------
Bridgy (https://brid.gy) is a free, open-source service that copies posts from
a personal website to social networks. You tell it about a new post by sending
it a "webmention": a tiny web request that says "this page exists, please
publish it to Mastodon" (or Bluesky). Bridgy then reads the page, formats the
post for each network (trimming it and adding a link back when it's too long),
and publishes it. Bridgy holds the Mastodon and Bluesky logins, so this script
needs no passwords or tokens.

Bridgy never publishes the same page twice, so sending a post again is safe:
Bridgy answers "already published" and nothing happens.

How it finds new posts
----------------------
This script never guesses web addresses. It waits until each new post shows up
in the live site's JSON feed (so the site has finished deploying, and the
address is exactly what Docusaurus built), then sends that address to Bridgy.

Two ways to run it
------------------
  --new-files FILE [FILE ...]   Post files added in recent commits (used on
                                push and by the daily safety-net run). Waits
                                for each to appear in the live feed.
  --url URL                     One specific post address (manual runs).

The safety net works from files added in commits, not from post dates in the
feed, on purpose: posts without a date in their file name (like Welcome.md)
get their date from git history, which can look recent on a fresh deploy.

Add --dry-run to print what would be sent without contacting Bridgy.

Needs only Python 3.9+ and its standard library. No packages to install.
"""

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# ============================== SETTINGS ===================================

# The live website. Docs: https://docusaurus.io/docs/api/docusaurus-config#url
SITE_URL = "https://quinnmchugh.net"

# Each blog folder in the repo, and the address of that blog's JSON feed on
# the live site. The feed address is "<routeBasePath>/feed.json", set by each
# blog's routeBasePath in docusaurus.config.js.
# Docs: https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog#feedOptions
BLOG_FOLDERS_TO_FEEDS = {
    "blog": "/blog/feed.json",
    "blog-micro": "/blog-micro/feed.json",
    "blog-ideas": "/ideas/feed.json",
}

# Networks to publish to. Each needs to be connected and set to "publish" on
# your Bridgy user page first. Docs: https://brid.gy/about
BRIDGY_TARGETS = [
    "https://brid.gy/publish/mastodon",
    "https://brid.gy/publish/bluesky",
]

# Where Bridgy receives webmentions. Docs: https://brid.gy/about
BRIDGY_WEBMENTION_ENDPOINT = "https://brid.gy/publish/webmention"

# How long to wait for a new post to appear on the live site, and how often
# to check. Vercel usually deploys this site in a few minutes.
WAIT_FOR_DEPLOY_MINUTES = 20
CHECK_EVERY_SECONDS = 30

# How long to wait for any single web request before giving up.
REQUEST_TIMEOUT_SECONDS = 60

# ===========================================================================

USER_AGENT = "send_new_posts_to_bridgy (+https://github.com/quinn-p-mchugh/personal-website)"


def say(message):
    """Print a status line straight away, so GitHub's log shows it live."""
    print(message, flush=True)


# ------------------------------ reading posts ------------------------------


def read_front_matter(path):
    """Return the simple `key: value` pairs from a post's front matter.

    Only flat values are read (draft, unlisted, slug, title), which is all
    this script needs. Lists and nested values are ignored.
    """
    text = Path(path).read_text(encoding="utf-8")
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}
    values = {}
    for line in text[3:end].splitlines():
        if ":" not in line or line.lstrip().startswith(("#", "-")):
            continue
        key, _, value = line.partition(":")
        values[key.strip()] = value.strip().strip("\"'")
    return values


def is_true(value):
    return str(value).strip().lower() == "true"


def describe_new_post(path):
    """Work out whether an added file is a publishable post.

    Returns (blog_folder, slug) for a post, or None with a printed reason for
    anything that isn't one. Follows Docusaurus's own rules: files starting
    with "_" are ignored, and posts marked draft or unlisted stay off the feed.
    Docs: https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog#markdown-front-matter
    """
    parts = Path(path).parts
    blog_folder = parts[0] if parts else ""
    if blog_folder not in BLOG_FOLDERS_TO_FEEDS:
        return None
    if Path(path).suffix.lower() not in (".md", ".mdx"):
        return None
    if any(part.startswith("_") for part in parts) or "draft" in parts:
        say(f"  skip  {path}  (template or draft folder)")
        return None
    if not Path(path).exists():
        say(f"  skip  {path}  (file no longer exists)")
        return None

    front_matter = read_front_matter(path)
    if is_true(front_matter.get("draft")):
        say(f"  skip  {path}  (draft: true)")
        return None
    if is_true(front_matter.get("unlisted")):
        say(f"  skip  {path}  (unlisted: true)")
        return None

    # Docusaurus builds the end of the address from the front matter `slug`
    # if there is one, otherwise from the file name minus its date prefix
    # (or the folder name, for a post written as folder/index.md).
    slug = front_matter.get("slug", "").strip("/")
    if not slug:
        name = Path(path).stem
        if name == "index":
            name = Path(path).parent.name
        pieces = name.split("-", 3)
        if len(pieces) == 4 and all(p.isdigit() for p in pieces[:3]):
            name = pieces[3]
        slug = name
    return blog_folder, slug


# ------------------------------ reading feeds ------------------------------


def fetch(url, data=None):
    """Make a web request. Returns (status code, response text, headers)."""
    request = urllib.request.Request(
        url,
        data=urllib.parse.urlencode(data).encode() if data else None,
        headers={"User-Agent": USER_AGENT},
    )
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            return response.status, response.read().decode("utf-8", "replace"), response.headers
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode("utf-8", "replace"), error.headers


def read_feed(blog_folder):
    """Return the addresses of the posts in a blog's live feed."""
    feed_url = SITE_URL + BLOG_FOLDERS_TO_FEEDS[blog_folder]
    # A changing query string makes caches hand back the newest copy.
    status, body, _ = fetch(f"{feed_url}?nocache={int(time.time())}")
    if status != 200:
        raise RuntimeError(f"Could not read {feed_url} (HTTP {status})")
    items = json.loads(body).get("items", [])
    return [item["url"] for item in items if item.get("url")]


def address_ends_with_slug(url, slug):
    path = urllib.parse.unquote(urllib.parse.urlparse(url).path).rstrip("/")
    return path.endswith("/" + urllib.parse.unquote(slug))


def wait_for_posts_to_go_live(posts):
    """Wait until every (blog_folder, slug) appears in its live feed.

    Returns (found addresses, slugs that never appeared).
    """
    waiting = list(posts)
    found = []
    deadline = time.monotonic() + WAIT_FOR_DEPLOY_MINUTES * 60
    while True:
        for blog_folder in sorted({folder for folder, _ in waiting}):
            try:
                live = read_feed(blog_folder)
            except Exception as error:  # the site may be mid-deploy
                say(f"  note  {error}; will try again")
                continue
            for post in [p for p in waiting if p[0] == blog_folder]:
                matches = [url for url in live if address_ends_with_slug(url, post[1])]
                if matches:
                    say(f"  live  {matches[0]}")
                    found.append(matches[0])
                    waiting.remove(post)
        if not waiting:
            return found, []
        if time.monotonic() >= deadline:
            return found, waiting
        names = ", ".join(slug for _, slug in waiting)
        say(f"  wait  not on the live site yet: {names}. Checking again in {CHECK_EVERY_SECONDS}s.")
        time.sleep(CHECK_EVERY_SECONDS)


# ----------------------------- sending to Bridgy ---------------------------


def send_to_bridgy(post_url, dry_run):
    """Ask Bridgy to publish one post to each network. Returns True if fine."""
    all_fine = True
    for target in BRIDGY_TARGETS:
        network = target.rsplit("/", 1)[-1]
        if dry_run:
            say(f"  dry run  would send {post_url} to {network}")
            continue
        status, body, headers = fetch(
            BRIDGY_WEBMENTION_ENDPOINT, data={"source": post_url, "target": target}
        )
        if status in (200, 201, 202):
            where = headers.get("Location") or "accepted"
            say(f"  sent  {network}: {where}")
        elif "already published" in body:
            say(f"  ok    {network}: already published earlier, nothing to do")
        elif status == 429 and "already publishing" in body:
            say(f"  ok    {network}: Bridgy is already publishing this right now")
        else:
            all_fine = False
            short = " ".join(body.split())[:300]
            say(f"  FAILED  {network} (HTTP {status}): {short}")
    return all_fine


# ---------------------------------- main -----------------------------------


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    which = parser.add_mutually_exclusive_group(required=True)
    which.add_argument("--new-files", nargs="*", metavar="FILE")
    which.add_argument("--url")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.dry_run:
        say("Dry run: nothing will be sent to Bridgy.")

    problems = []
    if args.url:
        urls = [args.url]
    else:
        say("Checking the added files...")
        posts = [p for p in (describe_new_post(f) for f in args.new_files) if p]
        if not posts:
            say("No new published posts among the added files. Done.")
            return 0
        say(f"Waiting for {len(posts)} new post(s) to appear on {SITE_URL} ...")
        urls, missing = wait_for_posts_to_go_live(posts)
        for folder, slug in missing:
            problems.append(
                f"'{slug}' in {folder}/ never appeared in the live feed after "
                f"{WAIT_FOR_DEPLOY_MINUTES} minutes. Check the deploy, then re-run this "
                "workflow by hand with the post's address."
            )

    if not urls:
        say("No posts to send.")
    for url in urls:
        say(f"Post: {url}")
        if not send_to_bridgy(url, args.dry_run):
            problems.append(f"Bridgy did not accept {url}; see the FAILED lines above.")

    if problems:
        say("\nProblems:")
        for problem in problems:
            say(f"  - {problem}")
        return 1
    say("All done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

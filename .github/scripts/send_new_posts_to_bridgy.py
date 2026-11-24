#!/usr/bin/env python3
"""Send new blog posts to Bridgy so it cross-posts them to Mastodon and Bluesky.

What this does, in plain terms:
    Bridgy (https://brid.gy) is a free, open-source service that copies posts
    from a personal website to social networks. You tell it about a new post
    by sending it a "webmention": a tiny web request that says "this page
    exists, please publish it to Mastodon" (or Bluesky). Bridgy then reads the
    page, formats the post for each network (trimming it and adding a link
    back when it's too long), and publishes it. Bridgy holds the Mastodon and
    Bluesky logins, so this script needs no passwords or tokens.

    Bridgy never publishes the same page twice, so sending a post again is
    safe: Bridgy answers "already published" and nothing happens.

How it finds new posts:
    It works out each new post's address with Docusaurus's own rules, then
    waits until exactly that address shows up in the live site's JSON feed
    (so the site has finished deploying), then sends it.

    The safety-net run also works from files added in commits, not from post
    dates in the feed, on purpose: posts without a date in their file name
    (like Welcome.md) get their date from git history, which can look recent
    on a fresh deploy.

Saving where each post went:
    Bridgy answers each publish with the address of the new Mastodon or
    Bluesky post. With --record-syndication, those addresses are added to
    the post file's front matter as a "syndication" list. The website shows
    them as "Also on Mastodon · Bluesky" links, and Bridgy needs them to match
    replies, likes and reposts back to the post (backfeed), because untitled
    posts are cross-posted without a link back.
    Docs: https://brid.gy/about (backfeed) and
    https://indieweb.org/rel-syndication

Usage:
    send_new_posts_to_bridgy.py --new-files FILE [FILE ...] [--dry-run]
        Post files added in recent commits (used on push and by the daily
        safety-net run). Waits for each to appear in the live feed.
    send_new_posts_to_bridgy.py --url URL [--dry-run]
        One specific post address (manual runs). Its post file is found by
        address, so --record-syndication works here too.

    --dry-run prints what would be sent without contacting Bridgy.
    --record-syndication saves the new posts' addresses into the post files
    (the workflow commits them).

Needs only Python 3.9+ and its standard library. No packages to install.
Tests: test_send_new_posts_to_bridgy.py next to this file (run with npm test).
"""

import argparse
import http.client
import json
import os
import posixpath
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# ================================ SETTINGS ================================

# The live website. Docs: https://docusaurus.io/docs/api/docusaurus-config#url
SITE_URL = "https://quinnmchugh.net"

# Every blog on the site that should be cross-posted: its folder in the repo,
# and the address of its JSON feed on the live site. The address is
# "<routeBasePath>/feed.json", where routeBasePath is set for each blog in
# docusaurus.config.js.
# Docs: https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog#feedOptions
#
# To add a blog: add one line here. Name its folder "blog-something" so the
# workflow's "blog*/**" trigger notices it with no other change. Each blog
# also needs feedOptions with type "all" (or "json") in docusaurus.config.js,
# like the existing ones. To stop cross-posting a blog, delete its line.
BLOG_FOLDERS_TO_FEEDS = {
    "blog": "/blog/feed.json",
    "blog-micro": "/blog-micro/feed.json",
    "blog-ideas": "/ideas/feed.json",
    "blog-resources": "/resources/feed.json",
    "blog-highlights": "/highlights/feed.json",
}

# Networks to publish to. Each must be connected and set to "publish" on
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

# How many times to try a request to Bridgy that failed for a temporary
# reason (network error, HTTP 5xx, rate limit), and the pause between tries.
BRIDGY_ATTEMPTS = 3
BRIDGY_RETRY_SECONDS = 20

# ==========================================================================

USER_AGENT = (
    "send_new_posts_to_bridgy "
    "(+https://github.com/quinn-p-mchugh/personal-website)"
)

# Docusaurus's rule for a date in a blog post's path, relative to the blog
# folder: 2026-11-23-my-post.md, 2026/11/23/my-post.md or
# 2026-11-23-my-post/index.md. Copied from DATE_FILENAME_REGEX in
# @docusaurus/plugin-content-blog/lib/blogUtils.js (version 3.5.2).
# Docs: https://docusaurus.io/docs/blog#blog-post-date
DATE_IN_PATH = re.compile(
    r"^(?P<folder>.*)(?P<date>\d{4}[-/]\d{1,2}[-/]\d{1,2})[-/]?(?P<text>.*?)(?:/index)?\.mdx?$"
)

# What Docusaurus removes from an undated post's path to get its slug.
MARKDOWN_ENDING = re.compile(r"(?:/index)?\.mdx?$")

# A top-level "syndication:" line, and a YAML list item ("  - value").
SYNDICATION_KEY = re.compile(r"syndication\s*:(.*)$")
LIST_ITEM = re.compile(r"(\s*)-(?:\s|$)")

# Bridgy's wording for a page it has published before, and for a page it is
# publishing in another request right now (from Bridgy's publish.py).
ALREADY_PUBLISHED = "already published"
ALREADY_PUBLISHING = "already publishing"


@dataclass(frozen=True)
class ExpectedPost:
    """A new post file, and how to recognise its address in the live feed.

    Attributes:
        path: The file's path in the repository.
        blog_folder: Top-level folder, e.g. "blog-micro".
        address_path: The path part of the post's address, as Docusaurus
            builds it, e.g. "/blog-micro/2026/11/23/my-post".
    """

    path: str
    blog_folder: str
    address_path: str


@dataclass(frozen=True)
class Response:
    """The parts of an HTTP response this script uses.

    Attributes:
        status: HTTP status code, or 0 when no response arrived.
        body: Response text, or the network error's description.
        location: The Location header, or "".
    """

    status: int
    body: str
    location: str


# ================================ OUTPUT ==================================


def say(message: str) -> None:
    """Print a status line straight away, so GitHub's log shows it live.

    Args:
        message: Text to print.
    """
    print(message, flush=True)


def report_error(message: str) -> None:
    """Print an error, highlighted on the GitHub Actions run page.

    Outside GitHub Actions the "::error::" prefix is replaced by "ERROR: ".
    Docs: https://docs.github.com/actions/reference/workflows-and-actions/workflow-commands#setting-an-error-message

    Args:
        message: The problem, in plain words.
    """
    prefix = "::error::" if os.environ.get("GITHUB_ACTIONS") == "true" else "ERROR: "
    say(f"{prefix}{message}")


# ============================ READING POST FILES ==========================


def front_matter_value(raw: str) -> str:
    """Clean one front matter value the way YAML reads simple scalars.

    A quoted value keeps everything inside its quotes, including " #". An
    unquoted value loses a trailing " # comment".

    Args:
        raw: The text after "key:", e.g. ' "my #1 post"  # note'.

    Returns:
        The value, e.g. "my #1 post".
    """
    value = raw.strip()
    if value[:1] in ("'", '"'):
        closing = value.find(value[0], 1)
        return value[1:closing] if closing != -1 else value[1:]
    return value.split(" #", 1)[0].strip()


def read_front_matter(path: str) -> Dict[str, str]:
    """Read the simple "key: value" lines from a post's front matter.

    Only flat, top-level values are read (draft, unlisted, slug, date),
    which is all this script needs. List items, comments and nested values
    are ignored. A byte-order mark or bytes that aren't valid UTF-8 don't
    stop the file being read.

    Args:
        path: Path to a Markdown file.

    Returns:
        A dict of keys to cleaned values. Empty if the file has no front
        matter.
    """
    text = Path(path).read_text(encoding="utf-8", errors="replace").lstrip("\ufeff")
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}
    values = {}
    for line in text[3:end].splitlines():
        stripped = line.strip()
        is_nested = line[:1].isspace()
        if ":" not in stripped or stripped.startswith(("#", "-")) or is_nested:
            continue
        key, _, value = stripped.partition(":")
        values[key.strip()] = front_matter_value(value)
    return values


def is_true(value: Optional[str]) -> bool:
    """Tell whether a front matter value means true.

    Args:
        value: A front matter value, or None if the key is absent.

    Returns:
        True only for "true" in any letter case.
    """
    return str(value).strip().lower() == "true"


def skip_reason(path: str) -> Optional[str]:
    """Explain why an added file is not a post to publish, if it isn't.

    Follows Docusaurus's own rules: files and folders starting with "_" are
    ignored, and posts marked draft or unlisted stay off the feed. Two rules
    are this site's own: the "draft" folder holds unfinished posts, and
    undated files (like each blog's Welcome.md) are pages, not posts.
    Docs: https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog#markdown-front-matter

    Args:
        path: Path of an added file, relative to the repository root.

    Returns:
        A short reason to skip it; "" if it isn't a Markdown file in a blog
        folder at all (skipped without comment); None if it is a post to
        publish. A file in an unlisted "blog..." folder gets a reason, so a
        newly added blog that was never configured shows up in the log.
    """
    file = Path(path)
    if file.suffix.lower() not in (".md", ".mdx") or len(file.parts) < 2:
        return ""
    if file.parts[0] not in BLOG_FOLDERS_TO_FEEDS:
        if file.parts[0].startswith("blog"):
            return f"{file.parts[0]}/ is not listed in BLOG_FOLDERS_TO_FEEDS, so it isn't cross-posted"
        return ""
    if any(part.startswith("_") for part in file.parts):
        return "template"
    if "draft" in file.parts:
        return "in the draft folder"
    if not file.exists():
        return "file no longer exists"
    front_matter = read_front_matter(path)
    if is_true(front_matter.get("draft")):
        return "draft: true"
    if is_true(front_matter.get("unlisted")):
        return "unlisted: true"
    has_date = bool(front_matter.get("date")) or DATE_IN_PATH.match(blog_relative_path(file))
    if not has_date:
        return "no date in its file name or front matter, so it's a page like Welcome.md"
    return None


def blog_relative_path(file: Path) -> str:
    """Get a post's path inside its blog folder, the way Docusaurus sees it.

    Args:
        file: Path of a post file, relative to the repository root, whose
            first part is the blog folder.

    Returns:
        The rest of the path with "/" separators, e.g.
        "2026/2026-11-23-my-post.md".
    """
    return Path(*file.parts[1:]).as_posix()


def post_slug(relative_path: str, front_matter: Dict[str, str]) -> str:
    """Work out a post's slug exactly as Docusaurus does.

    A front matter "slug" wins. Otherwise a date in the path becomes
    /YYYY/MM/DD/ followed by the rest of the path; an undated post's slug is
    its whole path. A front matter "date" never changes the address.
    Ported from parseBlogFileName and processBlogSourceFile in
    @docusaurus/plugin-content-blog/lib/blogUtils.js (version 3.5.2).
    Docs: https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog#markdown-front-matter

    Args:
        relative_path: The post's path inside its blog folder.
        front_matter: The post's front matter values.

    Returns:
        The slug, e.g. "/2026/11/23/my-post".
    """
    if front_matter.get("slug"):
        return front_matter["slug"]
    dated = DATE_IN_PATH.match(relative_path)
    if dated:
        date = dated.group("date").replace("-", "/")
        return f"/{date}/{dated.group('folder')}{dated.group('text')}"
    return "/" + MARKDOWN_ENDING.sub("", relative_path)


def normalize_address_path(path: str) -> str:
    """Put an address path into one standard form for comparing.

    Decodes %-escapes, merges repeated slashes and drops the trailing slash,
    so "/ideas//my%20post/" and "/ideas/my post" compare equal.

    Args:
        path: The path part of an address.

    Returns:
        The path in standard form, starting with "/".
    """
    decoded = urllib.parse.unquote(path)
    return "/" + "/".join(part for part in decoded.split("/") if part)


def route_base_path(blog_folder: str) -> str:
    """Get a blog's address prefix (its routeBasePath) from its feed address.

    Args:
        blog_folder: A key of BLOG_FOLDERS_TO_FEEDS.

    Returns:
        The site's base path plus the blog's route, e.g. "/ideas" for a
        feed at "/ideas/feed.json".
    """
    site_path = urllib.parse.urlparse(SITE_URL).path
    return site_path + posixpath.dirname(BLOG_FOLDERS_TO_FEEDS[blog_folder])


def expected_post(path: str) -> ExpectedPost:
    """Work out a post's exact address path from its file.

    Args:
        path: Path of a post file, relative to the repository root.

    Returns:
        The expected post.
    """
    file = Path(path)
    blog_folder = file.parts[0]
    slug = post_slug(blog_relative_path(file), read_front_matter(path))
    address_path = normalize_address_path(f"{route_base_path(blog_folder)}/{slug}")
    return ExpectedPost(path, blog_folder, address_path)


def posts_to_publish(paths: List[str]) -> List[ExpectedPost]:
    """Pick out the publishable posts from a list of added files.

    Prints one line for each file that is skipped, and why.

    Args:
        paths: Paths of added files, relative to the repository root.

    Returns:
        The posts to wait for and publish, in the order given.
    """
    posts = []
    for path in paths:
        reason = skip_reason(path)
        if reason is None:
            posts.append(expected_post(path))
        elif reason:
            say(f"  skip  {path}  ({reason})")
    return posts


# ============================== WEB REQUESTS ==============================


def request(url: str, form: Optional[Dict[str, str]] = None) -> Response:
    """Make one web request, never raising.

    Args:
        url: Address to request.
        form: Form fields to send as a POST. Omit for a GET.

    Returns:
        The response. A network failure or timeout comes back as status 0
        with the error's description as the body.
    """
    data = urllib.parse.urlencode(form).encode() if form else None
    try:
        req = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as res:
            body = res.read().decode("utf-8", "replace")
            return Response(res.status, body, res.headers.get("Location") or "")
    except urllib.error.HTTPError as error:
        return Response(error.code, read_error_body(error), error.headers.get("Location") or "")
    except (urllib.error.URLError, http.client.HTTPException, OSError, ValueError) as error:
        # URLError: no connection. HTTPException: the answer was cut off.
        # OSError: timeouts and resets. ValueError: not a web address.
        return Response(0, str(getattr(error, "reason", error)), "")


def read_error_body(error: urllib.error.HTTPError) -> str:
    """Read the text of an HTTP error response, never raising.

    Args:
        error: The error urllib raised for a 4xx or 5xx answer.

    Returns:
        The response text, or "" if it couldn't be read.
    """
    try:
        return error.read().decode("utf-8", "replace")
    except (http.client.HTTPException, OSError):
        return ""


def short(text: str, limit: int = 300) -> str:
    """Collapse whitespace and cut text to a readable length for the log.

    Args:
        text: Any text, e.g. an HTML error page.
        limit: Maximum characters to keep.

    Returns:
        The text on one line, at most `limit` characters.
    """
    return " ".join(text.split())[:limit]


# =============================== LIVE FEEDS ===============================


def read_feed(blog_folder: str) -> List[str]:
    """Read the addresses of the posts in one blog's live feed.

    Args:
        blog_folder: A key of BLOG_FOLDERS_TO_FEEDS.

    Returns:
        Post addresses, newest first.

    Raises:
        RuntimeError: If the feed can't be fetched or isn't valid JSON.
    """
    feed_url = SITE_URL + BLOG_FOLDERS_TO_FEEDS[blog_folder]
    # A changing query string makes caches hand back the newest copy.
    res = request(f"{feed_url}?nocache={int(time.time())}")
    if res.status != 200:
        raise RuntimeError(f"could not read {feed_url} (HTTP {res.status}: {short(res.body, 120)})")
    try:
        items = json.loads(res.body).get("items", [])
    except (ValueError, AttributeError) as error:
        raise RuntimeError(f"{feed_url} is not a valid JSON feed ({error})") from error
    if not isinstance(items, list):
        raise RuntimeError(f"{feed_url} has no list of items")
    return [item["url"] for item in items if isinstance(item, dict) and isinstance(item.get("url"), str)]


def address_matches(url: str, post: ExpectedPost) -> bool:
    """Tell whether an address is the expected post's.

    The whole path must match, so an older post with the same name can't be
    mistaken for the new one.

    Args:
        url: A full address, e.g. from the live feed.
        post: The expected post.

    Returns:
        True if the address belongs to the post.
    """
    return normalize_address_path(urllib.parse.urlparse(url).path) == post.address_path


def find_live_posts(waiting: List[ExpectedPost]) -> Dict[ExpectedPost, str]:
    """Check the live feeds once for the posts still being waited for.

    A feed that can't be read is reported and treated as "not yet", since
    the site may be part-way through deploying.

    Args:
        waiting: Posts not found yet.

    Returns:
        The posts found, each mapped to its live address.
    """
    found = {}
    for blog_folder in sorted({post.blog_folder for post in waiting}):
        try:
            live = read_feed(blog_folder)
        except RuntimeError as error:
            say(f"  note  {error}; will try again")
            continue
        for post in (p for p in waiting if p.blog_folder == blog_folder):
            match = next((url for url in live if address_matches(url, post)), None)
            if match:
                found[post] = match
    return found


def wait_for_posts_to_go_live(
    posts: List[ExpectedPost],
) -> Tuple[List[Tuple[ExpectedPost, str]], List[ExpectedPost]]:
    """Wait until every post appears in its live feed, or time runs out.

    Args:
        posts: Posts to wait for.

    Returns:
        A pair: (post, live address) for each post found, and the posts that
        never appeared within WAIT_FOR_DEPLOY_MINUTES.
    """
    waiting = list(posts)
    found = []
    deadline = time.monotonic() + WAIT_FOR_DEPLOY_MINUTES * 60
    while waiting:
        for post, url in find_live_posts(waiting).items():
            say(f"  live  {url}")
            found.append((post, url))
            waiting.remove(post)
        if not waiting or time.monotonic() >= deadline:
            break
        names = ", ".join(post.address_path for post in waiting)
        say(f"  wait  not on the live site yet: {names}. Checking again in {CHECK_EVERY_SECONDS}s.")
        time.sleep(CHECK_EVERY_SECONDS)
    return found, waiting


# ============================ SENDING TO BRIDGY ===========================


def is_temporary_failure(res: Response) -> bool:
    """Tell whether a failed Bridgy request is worth trying again.

    Args:
        res: Bridgy's response.

    Returns:
        True for network errors, HTTP 5xx and rate limits, except Bridgy's
        "already publishing" 429, which means another request has it in hand.
    """
    if res.status == 429:
        return ALREADY_PUBLISHING not in res.body.lower()
    return res.status == 0 or res.status >= 500


def send_webmention(post_url: str, target: str) -> Response:
    """Ask Bridgy to publish one post to one network, retrying blips.

    Args:
        post_url: The post's live address.
        target: One of BRIDGY_TARGETS.

    Returns:
        Bridgy's final response.
    """
    form = {"source": post_url, "target": target}
    res = request(BRIDGY_WEBMENTION_ENDPOINT, form)
    for attempt in range(2, BRIDGY_ATTEMPTS + 1):
        if not is_temporary_failure(res):
            break
        say(f"  retry Bridgy answered HTTP {res.status}; trying again in {BRIDGY_RETRY_SECONDS}s "
            f"(attempt {attempt} of {BRIDGY_ATTEMPTS})")
        time.sleep(BRIDGY_RETRY_SECONDS)
        res = request(BRIDGY_WEBMENTION_ENDPOINT, form)
    return res


def describe_outcome(network: str, res: Response) -> Tuple[bool, str]:
    """Turn Bridgy's response into a pass/fail and a log line.

    Args:
        network: Network name for the log, e.g. "mastodon".
        res: Bridgy's response.

    Returns:
        A pair: True if nothing more needs doing, and the line to print.
    """
    if 200 <= res.status < 300:
        return True, f"  sent  {network}: {res.location or 'accepted'}"
    if ALREADY_PUBLISHED in res.body.lower():
        return True, f"  ok    {network}: already published earlier, nothing to do"
    if res.status == 429 and ALREADY_PUBLISHING in res.body.lower():
        return True, f"  ok    {network}: Bridgy is already publishing this right now"
    return False, f"  FAILED  {network} (HTTP {res.status}): {short(res.body)}"


def send_to_bridgy(post_url: str, dry_run: bool) -> Tuple[bool, List[str]]:
    """Ask Bridgy to publish one post to every network in BRIDGY_TARGETS.

    Args:
        post_url: The post's live address.
        dry_run: If True, only print what would be sent.

    Returns:
        A pair: True if every network published it, had already, or was
        skipped by the dry run; and the addresses of the posts Bridgy just
        created (from its Location header), in BRIDGY_TARGETS order.
    """
    all_fine = True
    published = []
    for target in BRIDGY_TARGETS:
        network = target.rstrip("/").rsplit("/", 1)[-1]
        if dry_run:
            say(f"  dry run  would send {post_url} to {network}")
            continue
        res = send_webmention(post_url, target)
        fine, line = describe_outcome(network, res)
        say(line)
        all_fine = all_fine and fine
        if 200 <= res.status < 300 and res.location.startswith(("https://", "http://")):
            published.append(res.location)
    return all_fine, published


# =========================== SAVING SYNDICATION ===========================


def split_front_matter(text: str) -> Optional[Tuple[str, str, str]]:
    """Split a Markdown file into its front matter and the rest.

    Args:
        text: The whole file, with any byte-order mark removed.

    Returns:
        (opening "---" line, front matter lines, closing "---" line onwards),
        or None if the file has no front matter.
    """
    match = re.match(r"(---[ \t]*\r?\n)(.*?)(^---[ \t]*(?:\r?\n|$).*)", text, re.S | re.M)
    return match.groups() if match else None


def add_syndication_lines(front_matter: str, urls: List[str], newline: str) -> str:
    """Add addresses to the "syndication" list in front matter text.

    Keeps everything else exactly as written. Adds a block list when there
    is no "syndication" key, turns an empty inline list ("syndication: []")
    into a block list, and appends to an existing block list, matching its
    indentation. Addresses already listed aren't repeated.
    Docs: https://indieweb.org/rel-syndication

    Args:
        front_matter: The lines between the "---" fences.
        urls: Addresses to add.
        newline: The file's line ending, "\n" or "\r\n".

    Returns:
        The updated front matter lines; unchanged if every address is
        already listed.

    Raises:
        ValueError: If "syndication" holds something this function can't
            safely extend, such as a non-empty inline list.
    """
    lines = front_matter.splitlines()
    key_index = next((i for i, line in enumerate(lines) if SYNDICATION_KEY.match(line)), None)
    if key_index is None:
        new = [*lines, "syndication:", *(f"  - {url}" for url in urls)]
        return newline.join(new) + newline

    inline = front_matter_value(SYNDICATION_KEY.match(lines[key_index]).group(1))
    if inline not in ("", "[]"):
        raise ValueError(f'"syndication: {inline}" is not a block list')
    end = key_index + 1
    while end < len(lines) and LIST_ITEM.match(lines[end]):
        end += 1
    items = lines[key_index + 1:end]
    indent = LIST_ITEM.match(items[0]).group(1) if items else "  "
    existing = {front_matter_value(item.split("-", 1)[1]) for item in items}
    added = [f"{indent}- {url}" for url in urls if url not in existing]
    if not added:
        return front_matter
    new = [*lines[:key_index], "syndication:", *items, *added, *lines[end:]]
    return newline.join(new) + newline


def record_syndication(path: str, urls: List[str]) -> bool:
    """Save a post's cross-posted addresses into its front matter.

    Args:
        path: Path of the post file, relative to the repository root.
        urls: Addresses of the Mastodon and Bluesky copies.

    Returns:
        True if the file was changed. False, with a printed note, if there
        was nothing to add or the front matter couldn't be safely updated.
    """
    if not urls:
        return False
    file = Path(path)
    try:
        raw = file.read_bytes().decode("utf-8")
    except (OSError, UnicodeDecodeError) as error:
        say(f"  note  could not read {path} ({error}); addresses not saved: {', '.join(urls)}")
        return False
    bom = "\ufeff" if raw.startswith("\ufeff") else ""
    text = raw[len(bom):]
    parts = split_front_matter(text)
    if parts is None:
        say(f"  note  {path} has no front matter; addresses not saved")
        return False
    opening, front_matter, rest = parts
    newline = "\r\n" if "\r\n" in opening else "\n"
    try:
        updated = add_syndication_lines(front_matter, urls, newline)
    except ValueError as error:
        say(f"  note  {path}: {error}; addresses not saved")
        return False
    if updated == front_matter:
        return False
    try:
        file.write_bytes((bom + opening + updated + rest).encode("utf-8"))
    except OSError as error:
        say(f"  note  could not write {path} ({error}); addresses not saved: {', '.join(urls)}")
        return False
    say(f"  saved where {path} was posted: {', '.join(urls)}")
    return True


# ================================== MAIN ==================================


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    """Read the command-line options.

    Args:
        argv: Options to parse. Defaults to the real command line.

    Returns:
        The parsed options: new_files or url, dry_run, record_syndication.
    """
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    which = parser.add_mutually_exclusive_group(required=True)
    which.add_argument("--new-files", nargs="*", metavar="FILE",
                       help="post files added in recent commits")
    which.add_argument("--url", help="one post's live address")
    parser.add_argument("--dry-run", action="store_true",
                        help="print what would be sent, send nothing")
    parser.add_argument("--record-syndication", action="store_true",
                        help="save the new posts' addresses into the post files")
    return parser.parse_args(argv)


def find_post_file(url: str) -> Optional[str]:
    """Find the post file whose address is a given URL.

    Checks every publishable post in the blogs of BLOG_FOLDERS_TO_FEEDS, so
    a manual run by address can still save where the post went.

    Args:
        url: A post's full address.

    Returns:
        The file's path relative to the repository root, or None (with a
        printed note) if no post file has that address.
    """
    for blog_folder in BLOG_FOLDERS_TO_FEEDS:
        for file in sorted(Path(blog_folder).rglob("*.md*")):
            path = file.as_posix()
            if skip_reason(path) is None and address_matches(url, expected_post(path)):
                return path
    say(f"  note  no post file has the address {url}; addresses won't be saved")
    return None


def collect_urls(args: argparse.Namespace) -> Tuple[List[Tuple[Optional[str], str]], List[str]]:
    """Find the post addresses to send, waiting for new posts to go live.

    Args:
        args: Parsed options.

    Returns:
        A pair: (post file path, address) to send, where the path is None
        for a post given by address alone; and problems to report.
    """
    if args.url:
        return [(find_post_file(args.url), args.url)], []
    say("Checking the added files...")
    posts = posts_to_publish(args.new_files)
    if not posts:
        say("No new published posts among the added files.")
        return [], []
    say(f"Waiting for {len(posts)} new post(s) to appear on {SITE_URL} ...")
    found, missing = wait_for_posts_to_go_live(posts)
    problems = [
        f"{post.path} never appeared in the live feed after {WAIT_FOR_DEPLOY_MINUTES} minutes. "
        "Check the deploy, then re-run this workflow by hand with the post's address."
        for post in missing
    ]
    return [(post.path, url) for post, url in found], problems


def publish_post(path: Optional[str], url: str, args: argparse.Namespace) -> Optional[str]:
    """Send one post to Bridgy and, if asked, save where it was published.

    Args:
        path: The post file, or None if it isn't known.
        url: The post's live address.
        args: Parsed options (dry_run, record_syndication).

    Returns:
        A problem to report, or None if everything worked.
    """
    say(f"Post: {url}")
    fine, published = send_to_bridgy(url, args.dry_run)
    if args.record_syndication and path and not args.dry_run:
        record_syndication(path, published)
    return None if fine else f"Bridgy did not accept {url}; see the FAILED lines above."


def main(argv: Optional[List[str]] = None) -> int:
    """Run the whole job.

    Args:
        argv: Options to parse. Defaults to the real command line.

    Returns:
        0 if everything worked, 1 if anything needs attention.
    """
    args = parse_args(argv)
    if args.dry_run:
        say("Dry run: nothing will be sent to Bridgy.")

    posts, problems = collect_urls(args)
    for path, url in posts:
        problem = publish_post(path, url, args)
        if problem:
            problems.append(problem)

    for problem in problems:
        report_error(problem)
    say("Finished with problems." if problems else "All done.")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Tests for send_new_posts_to_bridgy.py.

Run from the repository root:
    python3 -m unittest discover -s .github/scripts -p "test_*.py"

Needs only Python 3.9+ and its standard library. No test touches the
network: anything that would contact the live site or Bridgy is replaced
with a stand-in. The expected post addresses below were checked against a
real Docusaurus 3.5.2 build of this site.
Docs: https://docs.python.org/3/library/unittest.html
"""

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import send_new_posts_to_bridgy as script  # noqa: E402  (path set just above)

Response = script.Response


class InTemporaryRepo(unittest.TestCase):
    """Base class: each test runs inside an empty temporary folder."""

    def setUp(self):
        """Create the folder and move into it."""
        self._old_cwd = os.getcwd()
        self._folder = tempfile.TemporaryDirectory()
        os.chdir(self._folder.name)

    def tearDown(self):
        """Move back and delete the folder."""
        os.chdir(self._old_cwd)
        self._folder.cleanup()

    def write(self, path, text, newline="\n"):
        """Write a file, creating its folders.

        Args:
            path: Path relative to the temporary folder.
            text: File contents, written with "\\n" line endings.
            newline: Line ending to write instead of "\\n".

        Returns:
            The path, as given.
        """
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_bytes(text.replace("\n", newline).encode("utf-8"))
        return path


class FrontMatterTests(InTemporaryRepo):
    """Reading front matter values."""

    def test_value_cleaning(self):
        """Quotes keep " #"; unquoted values lose a trailing comment."""
        self.assertEqual(script.front_matter_value(' "my #1 post"  # note'), "my #1 post")
        self.assertEqual(script.front_matter_value(" plain # comment"), "plain")
        self.assertEqual(script.front_matter_value(" 'single'"), "single")
        self.assertEqual(script.front_matter_value(' "unclosed'), "unclosed")
        self.assertEqual(script.front_matter_value(""), "")

    def test_reads_flat_keys_only(self):
        """Nested keys, comments and list items are ignored; a BOM is fine."""
        path = self.write("p.md", "﻿---\ntitle: \"\"\ndraft: true\nnested:\n  slug: no\n#slug: no\n- item\n---\nbody\n")
        self.assertEqual(script.read_front_matter(path), {"title": "", "draft": "true", "nested": ""})

    def test_no_front_matter(self):
        """Files without complete front matter give no values."""
        self.assertEqual(script.read_front_matter(self.write("p.md", "just text\n")), {})
        self.assertEqual(script.read_front_matter(self.write("q.md", "---\nunclosed: yes\n")), {})


class SkipReasonTests(InTemporaryRepo):
    """Deciding which added files are posts to publish."""

    def test_not_a_blog_post(self):
        """Files outside blog folders, or not Markdown, are skipped silently."""
        self.assertEqual(script.skip_reason("README.md"), "")
        self.assertEqual(script.skip_reason("docs/page.md"), "")
        self.assertEqual(script.skip_reason("blog-micro/image.png"), "")

    def test_unlisted_blog_folder_is_reported(self):
        """A blog folder missing from the settings is named in the log."""
        self.assertIn("BLOG_FOLDERS_TO_FEEDS", script.skip_reason("blog-new/2026-11-24-a.md"))

    def test_docusaurus_and_site_rules(self):
        """Templates, drafts, unlisted posts and undated pages are skipped."""
        self.assertEqual(script.skip_reason("blog-micro/_template.md"), "template")
        self.assertEqual(script.skip_reason("blog-micro/_drafts/2026-11-24-a.md"), "template")
        self.assertEqual(script.skip_reason("blog-micro/draft/2026-11-24-a.md"), "in the draft folder")
        self.assertEqual(script.skip_reason("blog-micro/2026-11-24-gone.md"), "file no longer exists")
        self.write("blog-micro/2026-11-24-d.md", "---\ndraft: True\n---\n")
        self.assertEqual(script.skip_reason("blog-micro/2026-11-24-d.md"), "draft: true")
        self.write("blog-micro/2026-11-24-u.md", "---\nunlisted: true\n---\n")
        self.assertEqual(script.skip_reason("blog-micro/2026-11-24-u.md"), "unlisted: true")
        self.write("blog-micro/Welcome.md", "---\ntitle: \"\"\n---\n")
        self.assertIn("no date", script.skip_reason("blog-micro/Welcome.md"))

    def test_dated_posts_are_published(self):
        """A date in the file path or the front matter makes a file a post."""
        for path in (
            "blog-micro/2026-11-24-a.md",
            "blog-micro/2026/11/24/a.md",
            "blog-micro/2026-11-24-a/index.md",
            "blog-micro/undated-name.md",
        ):
            front_matter = "date: 2026-11-24\n" if "undated" in path else ""
            self.write(path, f"---\n{front_matter}---\n")
            self.assertIsNone(script.skip_reason(path), path)


class AddressTests(InTemporaryRepo):
    """Working out post addresses the way Docusaurus does."""

    def expect(self, path, front_matter, address):
        """Write a post and check its expected address path.

        Args:
            path: Post file path.
            front_matter: Front matter lines, without the fences.
            address: The address path Docusaurus 3.5.2 builds for it.
        """
        self.write(path, f"---\n{front_matter}---\nbody\n")
        self.assertEqual(script.expected_post(path).address_path, address, path)

    def test_addresses_match_docusaurus(self):
        """Each address equals what Docusaurus 3.5.2 builds for the file."""
        self.expect("blog-micro/2026-11-23-my-post.md", "", "/blog-micro/2026/11/23/my-post")
        self.expect("blog-micro/2026/2026-11-23-in-year.md", "", "/blog-micro/2026/11/23/2026/in-year")
        self.expect("blog-micro/2026/11/23/nested.md", "", "/blog-micro/2026/11/23/nested")
        self.expect("blog-micro/2026-11-22-folder/index.md", "", "/blog-micro/2026/11/22/folder")
        self.expect("blog-micro/fm-date.md", "date: 2026-11-20\n", "/blog-micro/fm-date")
        self.expect("blog-micro/2026-11-21-ignored.md", "slug: custom\n", "/blog-micro/custom")
        self.expect("blog-micro/abs.md", "slug: /absolute/\n", "/blog-micro/absolute")
        self.expect("blog-ideas/2026-11-24-idea.md", "", "/ideas/2026/11/24/idea")
        self.expect("blog-micro/2026-11-24-has space.md", "", "/blog-micro/2026/11/24/has space")

    def test_address_matching_is_exact(self):
        """Only the whole path matches, after decoding and tidying slashes."""
        post = script.ExpectedPost("x", "blog-micro", "/blog-micro/2026/11/23/my-post")
        self.assertTrue(script.address_matches("https://quinnmchugh.net/blog-micro/2026/11/23/my-post/", post))
        self.assertTrue(script.address_matches("https://quinnmchugh.net/blog-micro//2026/11/23/my%2Dpost", post))
        self.assertFalse(script.address_matches("https://quinnmchugh.net/blog-micro/2025/11/23/my-post", post))
        self.assertFalse(script.address_matches("https://quinnmchugh.net/blog-micro/2026/11/23/old-my-post", post))

    def test_find_post_file(self):
        """A manual run by address finds the post file, or reports none."""
        self.write("blog-micro/2026-11-23-my-post.md", "---\n---\n")
        self.write("blog-micro/_template.md", "---\n---\n")
        found = script.find_post_file("https://quinnmchugh.net/blog-micro/2026/11/23/my-post")
        self.assertEqual(found, "blog-micro/2026-11-23-my-post.md")
        with mock.patch.object(script, "say"):
            self.assertIsNone(script.find_post_file("https://quinnmchugh.net/blog-micro/nope"))


class FeedTests(unittest.TestCase):
    """Reading the live feeds, with the network replaced."""

    def read(self, response):
        """Read the blog-micro feed with a fixed response.

        Args:
            response: The Response the stand-in request returns.

        Returns:
            What read_feed returns.
        """
        with mock.patch.object(script, "request", return_value=response):
            return script.read_feed("blog-micro")

    def test_reads_urls(self):
        """Only items with a text "url" are kept."""
        body = '{"items": [{"url": "https://a/1"}, {"url": 5}, "junk", {"id": 1}]}'
        self.assertEqual(self.read(Response(200, body, "")), ["https://a/1"])

    def test_bad_feeds_raise(self):
        """Missing, broken or oddly shaped feeds raise RuntimeError."""
        for response in (Response(404, "missing", ""), Response(200, "not json", ""),
                         Response(200, "[]", ""), Response(200, '{"items": {}}', "")):
            with self.assertRaises(RuntimeError, msg=response):
                self.read(response)

    def test_wait_finds_posts_and_gives_up(self):
        """Found posts are returned; posts never found are listed as missing."""
        post = script.ExpectedPost("x", "blog-micro", "/blog-micro/a")
        late = script.ExpectedPost("y", "blog-micro", "/blog-micro/b")
        with mock.patch.object(script, "read_feed", return_value=["https://quinnmchugh.net/blog-micro/a/"]), \
                mock.patch.object(script, "WAIT_FOR_DEPLOY_MINUTES", 0), \
                mock.patch.object(script, "say"):
            found, missing = script.wait_for_posts_to_go_live([post, late])
        self.assertEqual(found, [(post, "https://quinnmchugh.net/blog-micro/a/")])
        self.assertEqual(missing, [late])


class BridgyTests(unittest.TestCase):
    """Understanding Bridgy's answers."""

    def test_temporary_failures(self):
        """Network errors, 5xx and rate limits retry; "already publishing" doesn't."""
        self.assertTrue(script.is_temporary_failure(Response(0, "timeout", "")))
        self.assertTrue(script.is_temporary_failure(Response(502, "", "")))
        self.assertTrue(script.is_temporary_failure(Response(429, "slow down", "")))
        self.assertFalse(script.is_temporary_failure(Response(429, "Already publishing", "")))
        self.assertFalse(script.is_temporary_failure(Response(400, "bad", "")))

    def test_outcomes(self):
        """Success, "already published" and "already publishing" all count as fine."""
        self.assertEqual(script.describe_outcome("m", Response(201, "", "https://x/1"))[0], True)
        self.assertEqual(script.describe_outcome("m", Response(400, "Already published: x", ""))[0], True)
        self.assertEqual(script.describe_outcome("m", Response(429, "already publishing", ""))[0], True)
        self.assertEqual(script.describe_outcome("m", Response(400, "No h-entry", ""))[0], False)

    def test_retries_then_gives_up(self):
        """A temporary failure is retried until Bridgy answers properly."""
        answers = [Response(503, "", ""), Response(201, "", "https://x/1")]
        with mock.patch.object(script, "request", side_effect=answers) as request, \
                mock.patch.object(script.time, "sleep"), mock.patch.object(script, "say"):
            self.assertEqual(script.send_webmention("https://site/p", "t").status, 201)
        self.assertEqual(request.call_count, 2)

    def test_send_collects_new_addresses(self):
        """Each network's new post address is collected, in target order."""
        answers = {t: Response(201, "", f"https://{i}/new") for i, t in enumerate(script.BRIDGY_TARGETS)}
        with mock.patch.object(script, "send_webmention", side_effect=lambda url, t: answers[t]), \
                mock.patch.object(script, "say"):
            fine, published = script.send_to_bridgy("https://site/p", dry_run=False)
        self.assertTrue(fine)
        self.assertEqual(published, [answers[t].location for t in script.BRIDGY_TARGETS])

    def test_request_never_raises(self):
        """A bad address comes back as status 0 rather than an exception."""
        self.assertEqual(script.request("not a url").status, 0)


class SyndicationTests(InTemporaryRepo):
    """Saving cross-posted addresses into front matter."""

    URLS = ["https://a.social/1", "https://bsky.app/2"]

    def test_list_shapes(self):
        """New, empty, unindented and complete lists are all handled; others refused."""
        add = script.add_syndication_lines
        self.assertEqual(add("title: x\n", self.URLS, "\n"),
                         "title: x\nsyndication:\n  - https://a.social/1\n  - https://bsky.app/2\n")
        self.assertEqual(add("syndication: []  # c\n", self.URLS[:1], "\n"),
                         "syndication:\n  - https://a.social/1\n")
        self.assertEqual(add("syndication:\n- \"https://old/0\"\nt: x\n", self.URLS[:1], "\n"),
                         "syndication:\n- \"https://old/0\"\n- https://a.social/1\nt: x\n")
        unchanged = "syndication:\n  - https://a.social/1\n  - https://bsky.app/2\n"
        self.assertEqual(add(unchanged, self.URLS, "\n"), unchanged)
        with self.assertRaises(ValueError):
            add("syndication: [x]\n", self.URLS, "\n")

    def test_record_keeps_bom_and_line_endings(self):
        """Saving keeps the BOM and CRLF, and never repeats an address."""
        path = self.write("blog-micro/p.md", "﻿---\ntitle: \"\"\n---\nbody\n", newline="\r\n")
        with mock.patch.object(script, "say"):
            self.assertTrue(script.record_syndication(path, self.URLS))
            self.assertFalse(script.record_syndication(path, self.URLS))  # already there
        self.assertEqual(Path(path).read_bytes().decode("utf-8"),
                         "﻿---\r\ntitle: \"\"\r\nsyndication:\r\n  - https://a.social/1\r\n"
                         "  - https://bsky.app/2\r\n---\r\nbody\r\n")

    def test_record_survives_bad_files(self):
        """Unreadable, missing or front-matter-less files are skipped with a note."""
        self.write("blog-micro/none.md", "no front matter\n")
        Path("blog-micro/bad.md").write_bytes(b"---\n\xff\n---\n")
        with mock.patch.object(script, "say"):
            self.assertFalse(script.record_syndication("blog-micro/none.md", self.URLS))
            self.assertFalse(script.record_syndication("blog-micro/bad.md", self.URLS))
            self.assertFalse(script.record_syndication("blog-micro/missing.md", self.URLS))
            self.assertFalse(script.record_syndication("blog-micro/none.md", []))


class MainTests(InTemporaryRepo):
    """The whole run, with the network replaced."""

    def test_dry_run_sends_nothing(self):
        """A dry run contacts no one and succeeds."""
        self.write("blog-micro/2026-11-23-a.md", "---\n---\n")
        live = ["https://quinnmchugh.net/blog-micro/2026/11/23/a"]
        with mock.patch.object(script, "read_feed", return_value=live), \
                mock.patch.object(script, "send_webmention") as send, \
                mock.patch.object(script, "say"):
            code = script.main(["--new-files", "blog-micro/2026-11-23-a.md", "--dry-run"])
        self.assertEqual(code, 0)
        send.assert_not_called()

    def test_failure_is_reported(self):
        """A post Bridgy refuses makes the run fail."""
        self.write("blog-micro/2026-11-23-a.md", "---\n---\n")
        live = ["https://quinnmchugh.net/blog-micro/2026/11/23/a"]
        with mock.patch.object(script, "read_feed", return_value=live), \
                mock.patch.object(script, "send_webmention", return_value=Response(400, "nope", "")), \
                mock.patch.object(script, "say"):
            self.assertEqual(script.main(["--new-files", "blog-micro/2026-11-23-a.md"]), 1)

    def test_nothing_to_do(self):
        """No added files is a successful run."""
        with mock.patch.object(script, "say"):
            self.assertEqual(script.main(["--new-files"]), 0)


if __name__ == "__main__":
    unittest.main()

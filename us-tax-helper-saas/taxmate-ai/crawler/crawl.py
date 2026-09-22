"""IRS.gov crawler: BFS crawl of English HTML pages and PDF forms/publications.

Usage:
    python -m crawler.crawl --max-pages 50
    python -m crawler.crawl --max-pages 0 --incremental   # 0 = unlimited

Designed to be safe to run repeatedly (e.g. from a scheduled task / cron):
respects robots.txt, rate-limits requests, retries with backoff, and can
skip already-downloaded URLs via --incremental.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import random
import sys
from collections import deque
from dataclasses import dataclass, field
from typing import Any

import httpx

from . import config, storage, utils
from .parsing import parse_html
from .robots import RobotsRules, fetch_robots_txt
from .sitemap import extract_urls_from_sitemap_xml

logger = logging.getLogger("irs_crawler")


def setup_logging(log_path: str) -> None:
    logger.setLevel(logging.INFO)
    logger.handlers.clear()

    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")

    file_handler = logging.FileHandler(log_path, encoding="utf-8")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)


@dataclass
class CrawlStats:
    html_saved: int = 0
    html_low_quality: int = 0
    html_skipped_duplicate: int = 0
    pdf_saved: int = 0
    pdf_skipped_duplicate: int = 0
    skipped_non_english: int = 0
    skipped_disallowed_by_robots: int = 0
    skipped_excluded_path: int = 0
    failed_urls: list[str] = field(default_factory=list)


class Crawler:
    def __init__(
        self,
        max_pages: int,
        max_depth: int = config.MAX_DEPTH,
        incremental: bool = False,
        data_dir: str = config.DATA_DIR,
        extra_seeds: list[str] | None = None,
    ) -> None:
        self.max_pages = max_pages
        self.max_depth = max_depth
        self.incremental = incremental
        self.paths = storage.Paths.create(data_dir)
        self.index_writer = storage.IndexWriter(self.paths)
        self.stats = CrawlStats()

        self.seen_urls: set[str] = set()
        self.seen_pdf_hashes: set[str] = set()
        self.seen_text_hashes: set[str] = set()
        if incremental:
            existing = storage.load_existing_index(self.paths)
            self.seen_urls.update(existing.keys())
            logger.info("Incremental mode: loaded %d previously-seen URLs from index", len(existing))
            self.seen_text_hashes.update(storage.load_existing_text_hashes(self.paths))
            logger.info("Incremental mode: loaded %d previously-seen text hashes", len(self.seen_text_hashes))

        self.queue: deque[tuple[str, int]] = deque()
        self.seeds = list(config.SEED_URLS) + (extra_seeds or [])

        self.semaphore = asyncio.Semaphore(config.MAX_CONCURRENT_REQUESTS)
        self.robots_rules: RobotsRules | None = None
        self.pages_processed = 0

    # ---------------------------------------------------------------- fetch

    async def _fetch(self, client: httpx.AsyncClient, url: str) -> httpx.Response | None:
        for attempt in range(config.MAX_RETRIES + 1):
            async with self.semaphore:
                delay = random.uniform(config.MIN_DELAY_SECONDS, config.MAX_DELAY_SECONDS)
                await asyncio.sleep(delay)
                try:
                    resp = await client.get(
                        url,
                        headers={"User-Agent": config.USER_AGENT},
                        timeout=config.REQUEST_TIMEOUT_SECONDS,
                        follow_redirects=True,
                    )
                except (httpx.TransportError, httpx.TimeoutException) as exc:
                    logger.warning("Request error for %s (attempt %d): %s", url, attempt + 1, exc)
                    if attempt >= config.MAX_RETRIES:
                        return None
                    await asyncio.sleep(config.BACKOFF_BASE_SECONDS * (2 ** attempt))
                    continue

            if resp.status_code in config.RETRYABLE_STATUS_CODES:
                if attempt >= config.MAX_RETRIES:
                    logger.warning("Giving up on %s after %d retries (status %d)", url, attempt, resp.status_code)
                    return resp
                backoff = config.BACKOFF_BASE_SECONDS * (2 ** attempt)
                logger.info("Status %d for %s, backing off %.1fs (attempt %d)", resp.status_code, url, backoff, attempt + 1)
                await asyncio.sleep(backoff)
                continue

            return resp

        return None

    # ------------------------------------------------------------- filters

    def _should_visit(self, url: str) -> bool:
        if not utils.is_same_domain(url):
            return False
        if utils.is_excluded_language_path(url):
            self.stats.skipped_non_english += 1
            return False
        if not utils.is_pdf_url(url) and utils.is_excluded_utility_path(url):
            self.stats.skipped_excluded_path += 1
            return False
        if self.robots_rules and not self.robots_rules.is_allowed(url):
            self.stats.skipped_disallowed_by_robots += 1
            return False
        return True

    def _enqueue(self, url: str, depth: int) -> None:
        normalized = utils.normalize_url(url)
        if not normalized:
            return
        if normalized in self.seen_urls:
            return
        if not self._should_visit(normalized):
            return
        self.seen_urls.add(normalized)
        self.queue.append((normalized, depth))

    # --------------------------------------------------------------- pages

    async def _process_html(self, url: str, resp: httpx.Response, depth: int) -> None:
        parsed = parse_html(resp.text, url)

        if not utils.hreflang_is_english_or_absent(parsed.hreflangs):
            self.stats.skipped_non_english += 1
            return
        if parsed.lang_attr and not parsed.lang_attr.lower().startswith("en"):
            self.stats.skipped_non_english += 1
            return

        same_domain_links = [
            link for link in (utils.normalize_url(l) for l in parsed.links)
            if link and utils.is_same_domain(link)
        ]

        text_hash = utils.sha256_bytes(parsed.text.encode("utf-8"))
        is_duplicate = text_hash in self.seen_text_hashes
        if not is_duplicate:
            self.seen_text_hashes.add(text_hash)

        low_quality = len(parsed.text) < config.MIN_TEXT_LENGTH_FOR_QUALITY

        if is_duplicate:
            self.stats.html_skipped_duplicate += 1
            logger.info("Skipped duplicate HTML (text hash match): %s", url)
        else:
            record = {
                "url": url,
                "title": parsed.title,
                "lang": "en",
                "text": parsed.text,
                "headings": parsed.headings,
                "links": same_domain_links,
                "fetched_at": storage.now_iso(),
                "low_quality": low_quality,
                "text_sha256": text_hash,
            }
            if low_quality:
                self.stats.html_low_quality += 1

            slug = utils.slugify_url(url)
            path = storage.save_html_record(self.paths, slug, record)
            self.stats.html_saved += 1

            self.index_writer.write({
                "type": "html",
                "url": url,
                "path": str(path),
                "title": parsed.title,
                "fetched_at": record["fetched_at"],
                "low_quality": low_quality,
                "text_sha256": text_hash,
            })
            logger.info("Saved HTML [%d chars%s]: %s", len(parsed.text), " LOW_QUALITY" if low_quality else "", url)

        if depth < self.max_depth:
            for link in same_domain_links:
                self._enqueue(link, depth + 1)

    async def _process_pdf(self, url: str, resp: httpx.Response) -> None:
        content = resp.content
        file_hash = utils.sha256_bytes(content)
        if file_hash in self.seen_pdf_hashes:
            self.stats.pdf_skipped_duplicate += 1
            logger.info("Skipped duplicate PDF (hash match): %s", url)
            return
        self.seen_pdf_hashes.add(file_hash)

        filename = url.rsplit("/", 1)[-1] or f"{file_hash}.pdf"
        if not filename.lower().endswith(".pdf"):
            filename += ".pdf"

        form_number, year = utils.infer_form_metadata(filename)
        title = form_number or filename

        try:
            from pypdf import PdfReader
            import io
            reader = PdfReader(io.BytesIO(content))
            meta_title = (reader.metadata.title if reader.metadata else None) or None
            if meta_title:
                title = meta_title
        except Exception as exc:  # noqa: BLE001 - best-effort metadata extraction
            logger.debug("pypdf metadata extraction failed for %s: %s", url, exc)

        storage.save_pdf_file(self.paths, filename, content)
        meta_record = {
            "url": url,
            "title": title,
            "form_number": form_number,
            "year": year,
            "size": len(content),
            "sha256": file_hash,
            "fetched_at": storage.now_iso(),
        }
        meta_path = storage.save_pdf_metadata(self.paths, filename, meta_record)
        self.stats.pdf_saved += 1

        self.index_writer.write({
            "type": "pdf",
            "url": url,
            "path": str(self.paths.pdf_dir / filename),
            "title": title,
            "fetched_at": meta_record["fetched_at"],
        })
        logger.info("Saved PDF [%d bytes]: %s -> %s", len(content), url, filename)
        _ = meta_path

    async def _process_url(self, client: httpx.AsyncClient, url: str, depth: int) -> None:
        resp = await self._fetch(client, url)
        if resp is None:
            self.stats.failed_urls.append(url)
            return
        if resp.status_code >= 400:
            logger.warning("Failed %s: HTTP %d", url, resp.status_code)
            self.stats.failed_urls.append(url)
            return

        content_type = resp.headers.get("content-type", "")
        try:
            if utils.is_pdf_url(url) or "application/pdf" in content_type:
                await self._process_pdf(url, resp)
            elif "text/html" in content_type or not content_type:
                await self._process_html(url, resp, depth)
            else:
                logger.debug("Skipping unsupported content-type %s for %s", content_type, url)
        except Exception:  # noqa: BLE001
            logger.exception("Error processing %s", url)
            self.stats.failed_urls.append(url)

    # ----------------------------------------------------------------- run

    async def _seed_sitemap(self, client: httpx.AsyncClient, max_sub_sitemaps: int = 30) -> None:
        sitemap_url = f"{config.BASE_URL}/sitemap.xml"
        resp = await self._fetch(client, sitemap_url)
        if resp is None or resp.status_code >= 400:
            logger.info("No usable sitemap.xml at %s", sitemap_url)
            return
        urls = extract_urls_from_sitemap_xml(resp.text)

        # A top-level sitemap.xml is often a sitemap *index* pointing at
        # per-section sub-sitemaps (each itself XML, not a content page).
        # Expand those one level so real page URLs end up in the queue.
        sub_sitemaps = [u for u in urls if u.lower().endswith(".xml")]
        page_urls = [u for u in urls if not u.lower().endswith(".xml")]

        if sub_sitemaps and not page_urls:
            logger.info("sitemap.xml is a sitemap index with %d sub-sitemaps; expanding up to %d", len(sub_sitemaps), max_sub_sitemaps)
            for sub_url in sub_sitemaps[:max_sub_sitemaps]:
                sub_resp = await self._fetch(client, sub_url)
                if sub_resp is None or sub_resp.status_code >= 400:
                    continue
                page_urls.extend(extract_urls_from_sitemap_xml(sub_resp.text))

        logger.info("Discovered %d page URLs from sitemap.xml", len(page_urls))
        for u in page_urls:
            self._enqueue(u, depth=1)

    async def run(self) -> CrawlStats:
        async with httpx.AsyncClient() as client:
            _, self.robots_rules = await fetch_robots_txt(client)
            logger.info(
                "robots.txt loaded: %d disallow, %d allow rules",
                len(self.robots_rules.disallow), len(self.robots_rules.allow),
            )

            for seed in self.seeds:
                if seed.endswith("sitemap.xml"):
                    await self._seed_sitemap(client)
                else:
                    self._enqueue(seed, depth=0)

            while self.queue:
                if self.max_pages and self.pages_processed >= self.max_pages:
                    logger.info("Reached max_pages=%d, stopping BFS", self.max_pages)
                    break

                url, depth = self.queue.popleft()
                self.pages_processed += 1
                await self._process_url(client, url, depth)

        self.index_writer.close()
        return self.stats


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Crawl IRS.gov English content and PDFs.")
    parser.add_argument("--max-pages", type=int, default=50, help="Max pages to process (0 = unlimited). Default 50.")
    parser.add_argument("--max-depth", type=int, default=config.MAX_DEPTH, help=f"Max BFS depth. Default {config.MAX_DEPTH}.")
    parser.add_argument("--incremental", action="store_true", help="Skip URLs already present in the existing index.")
    parser.add_argument("--data-dir", type=str, default=config.DATA_DIR, help="Output data directory.")
    parser.add_argument("--log-file", type=str, default=config.LOG_FILENAME, help="Log file path.")
    parser.add_argument("--seed", action="append", default=[], help="Additional seed URL (repeatable).")
    return parser.parse_args(argv)


async def _main_async(args: argparse.Namespace) -> int:
    setup_logging(args.log_file)
    logger.info("Starting IRS.gov crawl: max_pages=%s max_depth=%s incremental=%s", args.max_pages, args.max_depth, args.incremental)

    crawler = Crawler(
        max_pages=args.max_pages,
        max_depth=args.max_depth,
        incremental=args.incremental,
        data_dir=args.data_dir,
        extra_seeds=args.seed,
    )
    stats = await crawler.run()

    logger.info("=" * 60)
    logger.info("Crawl complete.")
    logger.info("HTML saved: %d (low_quality: %d, duplicates skipped: %d)", stats.html_saved, stats.html_low_quality, stats.html_skipped_duplicate)
    logger.info("PDF saved: %d (duplicates skipped: %d)", stats.pdf_saved, stats.pdf_skipped_duplicate)
    logger.info("Skipped non-English: %d", stats.skipped_non_english)
    logger.info("Skipped excluded path: %d", stats.skipped_excluded_path)
    logger.info("Skipped disallowed by robots.txt: %d", stats.skipped_disallowed_by_robots)
    logger.info("Failed URLs: %d", len(stats.failed_urls))
    for failed in stats.failed_urls:
        logger.info("  FAILED: %s", failed)
    logger.info("=" * 60)

    return 0 if not stats.failed_urls else 1


def main() -> None:
    args = parse_args()
    exit_code = asyncio.run(_main_async(args))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()

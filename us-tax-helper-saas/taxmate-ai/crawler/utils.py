"""URL and content helper utilities for the IRS.gov crawler."""
from __future__ import annotations

import hashlib
import re
from urllib.parse import urljoin, urlparse, urlsplit, urlunsplit, parse_qsl, urlencode

from . import config


def normalize_url(url: str, base: str | None = None) -> str | None:
    """Resolve relative URLs, strip tracking params/fragment, drop trailing slash."""
    if base:
        url = urljoin(base, url)

    try:
        parts = urlsplit(url)
    except ValueError:
        return None

    if parts.scheme not in ("http", "https"):
        return None
    if not parts.netloc:
        return None

    query_pairs = [
        (k, v)
        for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if not k.lower().startswith(config.TRACKING_PARAM_PREFIXES)
        and k.lower() not in config.TRACKING_PARAM_NAMES
    ]
    query = urlencode(query_pairs)

    path = parts.path
    if len(path) > 1 and path.endswith("/"):
        path = path.rstrip("/")

    normalized = urlunsplit((parts.scheme.lower(), parts.netloc.lower(), path, query, ""))
    return normalized


def is_same_domain(url: str) -> bool:
    try:
        return urlparse(url).netloc.lower() == config.DOMAIN
    except ValueError:
        return False


def is_pdf_url(url: str) -> bool:
    path = urlparse(url).path.lower()
    return path.endswith(".pdf")


def is_pdf_priority(url: str) -> bool:
    path = urlparse(url).path.lower()
    return any(path.startswith(p) for p in config.PDF_PRIORITY_PATH_PREFIXES)


def is_excluded_language_path(url: str) -> bool:
    path = urlparse(url).path.lower()
    return any(path.startswith(p) for p in config.EXCLUDED_LANG_PATH_PREFIXES)


def is_excluded_utility_path(url: str) -> bool:
    path = urlparse(url).path
    return any(pattern.search(path) for pattern in config.EXCLUDED_PATH_PATTERNS)


def hreflang_is_english_or_absent(hreflang_values: list[str]) -> bool:
    if not hreflang_values:
        return True
    normalized = {h.strip().lower() for h in hreflang_values}
    return bool(normalized & config.ALLOWED_HREFLANGS) or "x-default" in normalized


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


_FORM_NUMBER_RE = re.compile(r"([fi]?\d{3,4}[a-z]{0,3})(?:--|-)?(\d{4})?", re.I)
_YEAR_RE = re.compile(r"(19|20)\d{2}")


def infer_form_metadata(filename_or_path: str) -> tuple[str | None, str | None]:
    """Best-effort extraction of (form_number, year) from an IRS PDF filename/path.

    IRS PDF filenames commonly look like: f1040.pdf, i1040gi.pdf, p17.pdf,
    f1040--2023.pdf, p17--2022.pdf.
    """
    name = filename_or_path.rsplit("/", 1)[-1]
    name = re.sub(r"\.pdf$", "", name, flags=re.I)

    year = None
    year_match = _YEAR_RE.search(name)
    if year_match:
        year = year_match.group(0)

    form_number = None
    base = re.split(r"--", name)[0]
    form_match = re.match(r"^[fip]\w+", base, re.I)
    if form_match:
        form_number = form_match.group(0).upper()
    elif base:
        form_number = base.upper()

    return form_number, year


def slugify_url(url: str) -> str:
    parts = urlparse(url)
    path = parts.path.strip("/") or "index"
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", path).strip("-").lower()
    if parts.query:
        query_hash = hashlib.sha1(parts.query.encode("utf-8")).hexdigest()[:8]
        slug = f"{slug}-{query_hash}"
    if not slug:
        slug = "index"
    # Guard against overly long filenames on Windows filesystems.
    if len(slug) > 150:
        digest = hashlib.sha1(slug.encode("utf-8")).hexdigest()[:12]
        slug = f"{slug[:130]}-{digest}"
    return slug

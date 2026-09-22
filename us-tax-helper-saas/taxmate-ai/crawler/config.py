"""Configuration for the IRS.gov crawler."""
from __future__ import annotations

import re

DOMAIN = "www.irs.gov"
BASE_URL = "https://www.irs.gov"
USER_AGENT = "TaxMateAI-IRSCrawler/1.0 (+https://taxmate.ai; contact: virtual.esq@gmail.com)"

SEED_URLS = [
    "https://www.irs.gov/help/telephone-assistance",
    "https://www.irs.gov/forms-instructions",
    "https://www.irs.gov/newsroom",
    "https://www.irs.gov/sitemap.xml",
]

MAX_DEPTH = 5

# Concurrency / rate limiting
MAX_CONCURRENT_REQUESTS = 2
MIN_DELAY_SECONDS = 1.0
MAX_DELAY_SECONDS = 2.0
MAX_RETRIES = 3
BACKOFF_BASE_SECONDS = 2.0
RETRYABLE_STATUS_CODES = {429, 503}

REQUEST_TIMEOUT_SECONDS = 30.0

# Language handling
EXCLUDED_LANG_PATH_PREFIXES = (
    "/es/", "/zh-hans/", "/zh-hant/", "/zh/", "/ru/", "/ar/", "/ko/", "/vi/",
    "/ht/",  # Haitian Creole, also present on irs.gov
)
ALLOWED_HREFLANGS = {"en", "en-us"}

# Pages that are not meaningful text content even if same-domain/English
EXCLUDED_PATH_PATTERNS = (
    re.compile(r"^/search", re.I),
    re.compile(r"^/login", re.I),
    re.compile(r"^/signin", re.I),
    re.compile(r"^/account/login", re.I),
    re.compile(r"/submit", re.I),
)

PDF_PRIORITY_PATH_PREFIXES = (
    "/pub/irs-pdf/",
    "/pub/irs-forms/",
    "/pub/irs-prior/",
)

TRACKING_PARAM_PREFIXES = ("utm_",)
TRACKING_PARAM_NAMES = {"gclid", "fbclid", "mc_cid", "mc_eid"}

MIN_TEXT_LENGTH_FOR_QUALITY = 200

DATA_DIR = "data"
HTML_SUBDIR = "html"
PDF_SUBDIR = "pdf"
INDEX_FILENAME = "index.jsonl"
LOG_FILENAME = "crawl.log"

import re
from urllib.parse import urlparse, urlunparse, urlencode, parse_qsl, quote, unquote
from typing import Optional
import tldextract


ALLOWED_SCHEMES = {"http", "https"}


class URLNormalizationError(ValueError):
    pass


def normalize_url(raw_url: str) -> str:
    """Parse, validate, and normalize a URL."""
    raw_url = raw_url.strip()
    if not raw_url:
        raise URLNormalizationError("Empty URL")

    # Decode percent-encoding once to detect double-encoded payloads
    decoded = unquote(raw_url)
    parsed = urlparse(decoded)

    if not parsed.scheme:
        # Prepend https:// and re-parse
        parsed = urlparse("https://" + decoded)

    scheme = parsed.scheme.lower()
    if scheme not in ALLOWED_SCHEMES:
        raise URLNormalizationError(f"Unsupported scheme: {scheme!r}")

    netloc = parsed.netloc.lower()
    if not netloc:
        raise URLNormalizationError("Missing hostname")

    # Strip credentials from netloc (user:pass@host)
    if "@" in netloc:
        netloc = netloc.split("@", 1)[1]

    # Normalize path
    path = parsed.path or "/"

    # Normalize query params (sorted for dedup)
    query = urlencode(sorted(parse_qsl(parsed.query, keep_blank_values=True)))

    normalized = urlunparse((scheme, netloc, path, "", query, ""))
    return normalized


def extract_domain_info(url: str):
    """Return tldextract result for a normalized URL."""
    parsed = urlparse(url)
    host = parsed.hostname or ""
    return tldextract.extract(host)


def is_ip_address(hostname: str) -> bool:
    ipv4 = re.compile(
        r"^(\d{1,3}\.){3}\d{1,3}$"
    )
    ipv6 = re.compile(r"^\[?[0-9a-fA-F:]+\]?$")
    return bool(ipv4.match(hostname) or ipv6.match(hostname))


def decode_punycode(hostname: str) -> Optional[str]:
    try:
        return hostname.encode("ascii").decode("idna")
    except (UnicodeError, UnicodeDecodeError):
        return None

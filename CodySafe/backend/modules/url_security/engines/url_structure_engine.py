"""Analyzes structural features of a URL for suspicious patterns."""
import re
from urllib.parse import urlparse, parse_qs
from typing import List, Tuple

from ..utils.url_normalizer import is_ip_address


SUSPICIOUS_EXTENSIONS = {".exe", ".bat", ".cmd", ".scr", ".vbs", ".ps1", ".msi", ".jar"}
LOGIN_PATH_PATTERNS = re.compile(
    r"/(login|signin|sign-in|account|auth|verify|secure|update|confirm|password|credential)",
    re.IGNORECASE,
)
PAYMENT_PATH_PATTERNS = re.compile(
    r"/(payment|checkout|billing|order|purchase|pay|cart)",
    re.IGNORECASE,
)
SUSPICIOUS_ENCODING_RE = re.compile(r"%[0-9a-fA-F]{2}")
STANDARD_PORTS = {80, 443, 8080, 8443}


def analyze_url_structure(url: str) -> Tuple[int, List[dict]]:
    """
    Returns (score_delta, indicators).
    score_delta: additive risk contribution (0-40 max from this engine).
    """
    parsed = urlparse(url)
    hostname = parsed.hostname or ""
    path = parsed.path or ""
    query = parsed.query or ""
    scheme = parsed.scheme.lower()

    indicators = []
    score = 0

    # Direct IP usage
    if is_ip_address(hostname):
        indicators.append({
            "type": "IP_ADDRESS_URL",
            "description": "IP 주소를 직접 사용하는 URL입니다.",
            "severity": "MEDIUM",
        })
        score += 10

    # Abnormally long URL
    if len(url) > 100:
        indicators.append({
            "type": "LONG_URL",
            "description": f"URL 길이가 비정상적으로 깁니다 ({len(url)}자).",
            "severity": "LOW",
        })
        score += 5

    # Excessive subdomains
    parts = hostname.split(".")
    subdomain_count = len(parts) - 2 if len(parts) > 2 else 0
    if subdomain_count >= 3:
        indicators.append({
            "type": "EXCESSIVE_SUBDOMAINS",
            "description": f"비정상적으로 많은 서브도메인이 있습니다 ({subdomain_count}개).",
            "severity": "MEDIUM",
        })
        score += 8

    # @ symbol in URL (credential phishing trick)
    if "@" in url and "://" in url:
        at_pos = url.find("@")
        scheme_end = url.find("://") + 3
        if scheme_end < at_pos:
            indicators.append({
                "type": "AT_SYMBOL_IN_URL",
                "description": "URL에 @ 기호가 포함되어 있어 자격 증명 위장에 악용될 수 있습니다.",
                "severity": "HIGH",
            })
            score += 15

    # Non-HTTPS
    if scheme == "http":
        indicators.append({
            "type": "HTTP_NOT_HTTPS",
            "description": "암호화되지 않은 HTTP 프로토콜을 사용합니다.",
            "severity": "LOW",
        })
        score += 3

    # Non-standard port
    port = parsed.port
    if port and port not in STANDARD_PORTS:
        indicators.append({
            "type": "UNUSUAL_PORT",
            "description": f"비표준 포트 {port}를 사용합니다.",
            "severity": "LOW",
        })
        score += 5

    # Suspicious file extension
    path_lower = path.lower()
    for ext in SUSPICIOUS_EXTENSIONS:
        if path_lower.endswith(ext):
            indicators.append({
                "type": "SUSPICIOUS_EXTENSION",
                "description": f"악성 파일 다운로드 가능성이 있는 확장자가 포함되어 있습니다 ({ext}).",
                "severity": "HIGH",
            })
            score += 15
            break

    # Login/payment path
    if LOGIN_PATH_PATTERNS.search(path):
        indicators.append({
            "type": "LOGIN_PATH_KEYWORD",
            "description": "로그인 또는 인증 페이지를 가장하는 경로가 포함되어 있습니다.",
            "severity": "LOW",
        })
        score += 3

    if PAYMENT_PATH_PATTERNS.search(path):
        indicators.append({
            "type": "PAYMENT_PATH_KEYWORD",
            "description": "결제 또는 주문 페이지를 가장하는 경로가 포함되어 있습니다.",
            "severity": "LOW",
        })
        score += 3

    # Suspicious encoding (excessive percent-encoding)
    encoding_count = len(SUSPICIOUS_ENCODING_RE.findall(url))
    if encoding_count > 10:
        indicators.append({
            "type": "SUSPICIOUS_ENCODING",
            "description": f"과도한 URL 인코딩이 탐지되었습니다 ({encoding_count}개).",
            "severity": "MEDIUM",
        })
        score += 8

    return min(score, 40), indicators

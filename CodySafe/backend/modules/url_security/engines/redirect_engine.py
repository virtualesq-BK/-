"""HTTP redirect chain analysis with SSRF protection."""
import re
from typing import List, Tuple, Dict, Any, Optional
from urllib.parse import urlparse

import httpx

from ..config import config
from ..utils.ssrf_guard import validate_hostname, SSRFViolation
from ..utils.url_normalizer import normalize_url, URLNormalizationError


URL_SHORTENERS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "short.link",
    "buff.ly", "adf.ly", "rb.gy", "cutt.ly", "is.gd", "v.gd",
    "bl.ink", "tiny.cc", "shorte.st", "po.st",
}


def _is_shortener(hostname: str) -> bool:
    return hostname.lower() in URL_SHORTENERS


def analyze_redirects(url: str) -> Tuple[int, List[dict], Dict[str, Any]]:
    parsed = urlparse(url)
    hostname = parsed.hostname or ""
    indicators: List[dict] = []
    score = 0

    result: Dict[str, Any] = {
        "checked": True,
        "redirect_count": 0,
        "final_url": url,
        "chain": [],
        "error": None,
    }

    # URL shortener detection (no HTTP request needed)
    if _is_shortener(hostname):
        indicators.append({
            "type": "URL_SHORTENER",
            "description": f"URL 단축 서비스({hostname})가 사용되었습니다. 최종 목적지가 불분명합니다.",
            "severity": "MEDIUM",
        })
        score += 10

    # SSRF pre-check
    try:
        validate_hostname(hostname)
    except SSRFViolation as e:
        result["checked"] = False
        result["error"] = f"SSRF_BLOCKED: {e}"
        indicators.append({
            "type": "SSRF_BLOCKED",
            "description": "요청이 내부 네트워크 주소로 차단되었습니다.",
            "severity": "CRITICAL",
        })
        return 30, indicators, result

    chain: List[str] = [url]
    current_url = url

    try:
        with httpx.Client(
            follow_redirects=False,
            timeout=httpx.Timeout(
                connect=config.REQUEST_TIMEOUT_CONNECT,
                read=config.REQUEST_TIMEOUT_READ,
                write=5.0,
                pool=5.0,
            ),
            headers={"User-Agent": "CodySafe-URLAnalyzer/1.0"},
            max_redirects=0,
        ) as client:
            for _ in range(config.REDIRECT_MAX_FOLLOW):
                cur_parsed = urlparse(current_url)
                cur_host = cur_parsed.hostname or ""
                try:
                    validate_hostname(cur_host)
                except SSRFViolation as e:
                    result["error"] = f"SSRF_BLOCKED_REDIRECT: {e}"
                    indicators.append({
                        "type": "SSRF_BLOCKED_REDIRECT",
                        "description": f"리다이렉션 목적지가 내부 주소로 차단되었습니다: {cur_host}",
                        "severity": "CRITICAL",
                    })
                    score += 30
                    break

                response = client.head(current_url, headers={"User-Agent": "CodySafe-URLAnalyzer/1.0"})

                if response.status_code in (301, 302, 303, 307, 308):
                    location = response.headers.get("location", "")
                    if not location:
                        break
                    try:
                        next_url = normalize_url(location)
                    except URLNormalizationError:
                        break
                    chain.append(next_url)
                    current_url = next_url
                else:
                    break

    except httpx.TimeoutException:
        result["error"] = "timeout"
    except httpx.RequestError as e:
        result["error"] = str(e)

    redirect_count = len(chain) - 1
    result["redirect_count"] = redirect_count
    result["final_url"] = chain[-1]
    result["chain"] = chain

    if redirect_count >= 3:
        indicators.append({
            "type": "MULTIPLE_REDIRECTS",
            "description": f"다중 리다이렉션이 탐지되었습니다 ({redirect_count}회).",
            "severity": "MEDIUM",
        })
        score += 10

    # Final URL domain differs from original
    orig_host = (urlparse(url).hostname or "").lower()
    final_host = (urlparse(result["final_url"]).hostname or "").lower()
    if orig_host and final_host and orig_host != final_host:
        indicators.append({
            "type": "REDIRECT_DOMAIN_CHANGE",
            "description": f"리다이렉션 후 도메인이 변경되었습니다 ({orig_host} → {final_host}).",
            "severity": "MEDIUM",
        })
        score += 8

    return min(score, 30), indicators, result

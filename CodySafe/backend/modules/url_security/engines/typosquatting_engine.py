"""Typosquatting and brand impersonation detection."""
import json
import os
from typing import List, Tuple, Dict, Any, Optional
from urllib.parse import urlparse

import tldextract

from ..utils.domain_utils import (
    normalize_domain_for_comparison,
    levenshtein,
    contains_homograph,
    is_punycode_domain,
)
from ..config import config


def _load_brands() -> Dict[str, List[str]]:
    """Load brands.json; return {brand_name: [official_domain, ...]}."""
    flat: Dict[str, List[str]] = {}
    path = config.BRANDS_CONFIG_PATH
    if not os.path.exists(path):
        return flat
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    for _category, brands in data.items():
        for brand, domains in brands.items():
            flat[brand] = domains
    return flat


_BRANDS: Optional[Dict[str, List[str]]] = None


def _get_brands() -> Dict[str, List[str]]:
    global _BRANDS
    if _BRANDS is None:
        _BRANDS = _load_brands()
    return _BRANDS


def analyze_typosquatting(url: str) -> Tuple[int, List[dict]]:
    parsed = urlparse(url)
    hostname = (parsed.hostname or "").lower()
    ext = tldextract.extract(hostname)
    registered_domain = f"{ext.domain}.{ext.suffix}" if ext.domain and ext.suffix else hostname
    subdomain = ext.subdomain or ""

    indicators = []
    score = 0

    # Punycode / IDN check
    if is_punycode_domain(hostname):
        indicators.append({
            "type": "PUNYCODE_DOMAIN",
            "description": f"Punycode(국제화 도메인)이 사용되었습니다: {hostname}",
            "severity": "MEDIUM",
        })
        score += 10

    # Homograph check
    if contains_homograph(hostname):
        indicators.append({
            "type": "HOMOGRAPH_ATTACK",
            "description": "시각적으로 유사한 유니코드 문자가 도메인에 사용되었습니다(Homograph Attack 의심).",
            "severity": "HIGH",
        })
        score += 20

    brands = _get_brands()
    norm_registered = normalize_domain_for_comparison(ext.domain) if ext.domain else ""
    norm_subdomain = normalize_domain_for_comparison(subdomain)

    for brand_name, official_domains in brands.items():
        norm_brand = normalize_domain_for_comparison(brand_name)

        for official_domain in official_domains:
            off_ext = tldextract.extract(official_domain)
            norm_official = normalize_domain_for_comparison(off_ext.domain)

            # Skip if this IS the official domain
            if registered_domain == official_domain:
                continue

            # Levenshtein distance check on the domain part
            dist = levenshtein(norm_registered, norm_official)
            domain_len = max(len(norm_registered), len(norm_official))

            # Exact brand name in subdomain (e.g. paypal.attacker.com)
            if norm_brand in norm_subdomain and ext.domain not in {off_ext.domain, brand_name}:
                indicators.append({
                    "type": "BRAND_IN_SUBDOMAIN",
                    "description": f"공식 브랜드명 '{brand_name}'이 서브도메인에서 발견되었습니다 ({hostname}).",
                    "severity": "HIGH",
                })
                score += 20
                break

            # Very close domain (typosquatting)
            if domain_len > 3 and 1 <= dist <= 2:
                indicators.append({
                    "type": "TYPOSQUATTING",
                    "description": f"'{brand_name}'의 공식 도메인과 유사한 도메인이 탐지되었습니다 (편집거리: {dist}).",
                    "severity": "HIGH",
                })
                score += 18
                break

            # Brand name embedded in different domain (e.g. amaz0n-support.com)
            if norm_brand in norm_registered and registered_domain not in official_domains:
                indicators.append({
                    "type": "BRAND_IMPERSONATION",
                    "description": f"'{brand_name}' 브랜드명이 비공식 도메인에 포함되어 있습니다.",
                    "severity": "HIGH",
                })
                score += 15
                break

    return min(score, 40), indicators

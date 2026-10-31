import unicodedata
from typing import Optional
import tldextract


# Homograph character substitution map (common confusables)
HOMOGRAPH_MAP = {
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x",
    "і": "i", "ο": "o", "ν": "v", "ρ": "p", "ω": "w",
    "0": "o", "1": "l", "l": "l", "I": "i",
}

COMMON_SUBSTITUTIONS = {
    "0": "o", "1": "l", "3": "e", "4": "a", "5": "s",
    "6": "g", "7": "t", "8": "b", "9": "g",
    "rn": "m", "vv": "w",
}


def normalize_domain_for_comparison(domain: str) -> str:
    """Lowercase, strip accents, apply common substitutions."""
    domain = domain.lower()
    # NFKD normalize to decompose accented chars
    domain = unicodedata.normalize("NFKD", domain)
    domain = "".join(c for c in domain if not unicodedata.combining(c))
    for k, v in COMMON_SUBSTITUTIONS.items():
        domain = domain.replace(k, v)
    return domain


def levenshtein(s1: str, s2: str) -> int:
    if len(s1) < len(s2):
        return levenshtein(s2, s1)
    if not s2:
        return len(s1)
    prev = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        curr = [i + 1]
        for j, c2 in enumerate(s2):
            curr.append(min(prev[j + 1] + 1, curr[j] + 1, prev[j] + (c1 != c2)))
        prev = curr
    return prev[-1]


def get_registered_domain(url_or_host: str) -> Optional[str]:
    ext = tldextract.extract(url_or_host)
    if ext.domain and ext.suffix:
        return f"{ext.domain}.{ext.suffix}"
    return None


def contains_homograph(text: str) -> bool:
    for ch in text:
        if ch in HOMOGRAPH_MAP and HOMOGRAPH_MAP[ch] != ch:
            return True
    return False


def is_punycode_domain(hostname: str) -> bool:
    return "xn--" in hostname.lower()

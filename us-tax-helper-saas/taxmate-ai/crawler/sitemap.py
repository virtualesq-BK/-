"""Minimal sitemap.xml / sitemap-index parsing."""
from __future__ import annotations

from xml.etree import ElementTree as ET

_NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}


def extract_urls_from_sitemap_xml(xml_text: str) -> list[str]:
    """Return <loc> URLs from either a urlset or a sitemapindex document."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []

    urls: list[str] = []
    for loc in root.findall(".//sm:loc", _NS):
        if loc.text:
            urls.append(loc.text.strip())

    if not urls:
        # Fallback: no namespace present.
        for loc in root.findall(".//loc"):
            if loc.text:
                urls.append(loc.text.strip())

    return urls

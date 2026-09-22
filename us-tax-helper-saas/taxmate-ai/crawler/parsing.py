"""HTML parsing helpers: text extraction, headings, links, hreflang, title."""
from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urljoin

try:
    from selectolax.parser import HTMLParser as _SelectolaxParser
    _HAS_SELECTOLAX = True
except ImportError:  # pragma: no cover
    _HAS_SELECTOLAX = False
    from bs4 import BeautifulSoup

REMOVE_TAGS = ("script", "style", "nav", "footer", "header", "noscript", "iframe", "svg", "form")


@dataclass
class ParsedPage:
    title: str
    text: str
    headings: list[str]
    links: list[str]
    hreflangs: list[str]
    lang_attr: str | None


def parse_html(html: str, base_url: str) -> ParsedPage:
    if _HAS_SELECTOLAX:
        return _parse_with_selectolax(html, base_url)
    return _parse_with_bs4(html, base_url)


def _parse_with_selectolax(html: str, base_url: str) -> ParsedPage:
    tree = _SelectolaxParser(html)

    for tag in REMOVE_TAGS:
        for node in tree.css(tag):
            node.decompose()

    title_node = tree.css_first("title")
    title = title_node.text(strip=True) if title_node else ""

    headings: list[str] = []
    for level in ("h1", "h2", "h3"):
        for node in tree.css(level):
            text = node.text(strip=True)
            if text:
                headings.append(text)

    body = tree.css_first("body")
    text = body.text(separator=" ", strip=True) if body else tree.text(separator=" ", strip=True)
    text = " ".join(text.split())

    links: list[str] = []
    for node in tree.css("a[href]"):
        href = node.attributes.get("href")
        if href:
            links.append(urljoin(base_url, href))

    hreflangs: list[str] = []
    for node in tree.css("link[rel=alternate][hreflang]"):
        value = node.attributes.get("hreflang")
        if value:
            hreflangs.append(value)

    html_node = tree.css_first("html")
    lang_attr = html_node.attributes.get("lang") if html_node else None

    return ParsedPage(title=title, text=text, headings=headings, links=links, hreflangs=hreflangs, lang_attr=lang_attr)


def _parse_with_bs4(html: str, base_url: str) -> ParsedPage:
    soup = BeautifulSoup(html, "html.parser")

    for tag in REMOVE_TAGS:
        for node in soup.find_all(tag):
            node.decompose()

    title = soup.title.get_text(strip=True) if soup.title else ""

    headings: list[str] = []
    for level in ("h1", "h2", "h3"):
        for node in soup.find_all(level):
            text = node.get_text(strip=True)
            if text:
                headings.append(text)

    body = soup.body
    text = body.get_text(separator=" ", strip=True) if body else soup.get_text(separator=" ", strip=True)
    text = " ".join(text.split())

    links: list[str] = []
    for node in soup.find_all("a", href=True):
        links.append(urljoin(base_url, node["href"]))

    hreflangs: list[str] = []
    for node in soup.find_all("link", rel="alternate", hreflang=True):
        hreflangs.append(node["hreflang"])

    lang_attr = soup.html.get("lang") if soup.html else None

    return ParsedPage(title=title, text=text, headings=headings, links=links, hreflangs=hreflangs, lang_attr=lang_attr)

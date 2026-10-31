"""Tests for URL structure analysis engine."""
import pytest
from backend.modules.url_security.engines.url_structure_engine import analyze_url_structure


def test_normal_https_url():
    score, inds = analyze_url_structure("https://www.google.com/search?q=hello")
    types = {i["type"] for i in inds}
    assert score < 20
    assert "AT_SYMBOL_IN_URL" not in types
    assert "IP_ADDRESS_URL" not in types


def test_http_url_flagged():
    score, inds = analyze_url_structure("http://example.com/")
    types = {i["type"] for i in inds}
    assert "HTTP_NOT_HTTPS" in types


def test_ip_address_url():
    score, inds = analyze_url_structure("http://192.168.1.1/admin")
    types = {i["type"] for i in inds}
    assert "IP_ADDRESS_URL" in types


def test_long_url():
    long_url = "https://example.com/" + "a" * 200
    score, inds = analyze_url_structure(long_url)
    types = {i["type"] for i in inds}
    assert "LONG_URL" in types


def test_at_symbol_in_url():
    score, inds = analyze_url_structure("https://legit.com@evil.com/phish")
    types = {i["type"] for i in inds}
    assert "AT_SYMBOL_IN_URL" in types


def test_excessive_subdomains():
    score, inds = analyze_url_structure("https://a.b.c.d.example.com/page")
    types = {i["type"] for i in inds}
    assert "EXCESSIVE_SUBDOMAINS" in types


def test_suspicious_extension():
    score, inds = analyze_url_structure("https://example.com/setup.exe")
    types = {i["type"] for i in inds}
    assert "SUSPICIOUS_EXTENSION" in types


def test_login_path():
    score, inds = analyze_url_structure("https://example.com/login/verify")
    types = {i["type"] for i in inds}
    assert "LOGIN_PATH_KEYWORD" in types


def test_unusual_port():
    score, inds = analyze_url_structure("https://example.com:9999/")
    types = {i["type"] for i in inds}
    assert "UNUSUAL_PORT" in types


def test_score_capped_at_40():
    # pile on a maximum-score URL
    score, inds = analyze_url_structure(
        "http://a.b.c.d.evil.com:9999/login.exe?" + "x=" * 200 + "&" + "y=" * 200
    )
    assert score <= 40

"""API endpoint integration tests using mocked engines."""
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def _mock_engines(monkeypatch):
    """Patch all engines to avoid real network calls."""
    monkeypatch.setattr(
        "backend.modules.url_security.engines.url_structure_engine.analyze_url_structure",
        lambda url: (0, []),
    )
    monkeypatch.setattr(
        "backend.modules.url_security.engines.domain_intelligence_engine.analyze_domain_intelligence",
        lambda url, check_ssl, check_dns: (0, [], {"dns_status": "available", "ssl_status": "valid", "whois_status": "unavailable"}),
    )
    monkeypatch.setattr(
        "backend.modules.url_security.engines.typosquatting_engine.analyze_typosquatting",
        lambda url: (0, []),
    )
    monkeypatch.setattr(
        "backend.modules.url_security.engines.redirect_engine.analyze_redirects",
        lambda url: (0, [], {"checked": True, "redirect_count": 0, "final_url": url, "chain": [url], "error": None}),
    )
    monkeypatch.setattr(
        "backend.modules.url_security.engines.threat_intelligence_engine.analyze_threat_intelligence",
        lambda url: (0, [], []),
    )


def test_health():
    resp = client.get("/api/v1/url-security/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["module"] == "url_security"
    assert "providers" in data


def test_analyze_safe_url(monkeypatch):
    _mock_engines(monkeypatch)
    resp = client.post("/api/v1/url-security/analyze", json={"url": "https://www.google.com/"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "risk_score" in data
    assert data["verdict"] in ("SAFE", "SUSPICIOUS", "MALICIOUS")


def test_analyze_missing_url():
    resp = client.post("/api/v1/url-security/analyze", json={})
    assert resp.status_code == 422


def test_analyze_empty_url():
    resp = client.post("/api/v1/url-security/analyze", json={"url": ""})
    assert resp.status_code == 422


def test_analyze_invalid_scheme(monkeypatch):
    _mock_engines(monkeypatch)
    resp = client.post("/api/v1/url-security/analyze", json={"url": "ftp://example.com"})
    assert resp.status_code == 200
    data = resp.json()
    # ftp:// is unsupported; service returns error status
    assert data["status"] == "error"


def test_analyze_options_false(monkeypatch):
    _mock_engines(monkeypatch)
    resp = client.post("/api/v1/url-security/analyze", json={
        "url": "https://example.com",
        "options": {
            "check_redirects": False,
            "check_dns": False,
            "check_ssl": False,
            "check_threat_intelligence": False,
        },
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["redirect_analysis"]["checked"] is False

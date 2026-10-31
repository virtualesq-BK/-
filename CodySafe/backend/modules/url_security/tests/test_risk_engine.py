"""Tests for risk scoring and verdict logic."""
import pytest
from backend.modules.url_security.engines.risk_engine import calculate_risk, build_recommendations


def test_low_risk():
    score, level, verdict = calculate_risk(0, 0, 0, 0, 0, [])
    assert score == 0
    assert level == "LOW"
    assert verdict == "SAFE"


def test_medium_risk():
    score, level, verdict = calculate_risk(10, 5, 10, 5, 0, [])
    assert level == "MEDIUM"
    assert verdict == "SUSPICIOUS"


def test_high_risk():
    score, level, verdict = calculate_risk(20, 10, 20, 10, 0, [])
    assert level in ("HIGH", "CRITICAL")
    assert verdict == "SUSPICIOUS"


def test_critical_ti_match():
    inds = [{"type": "THREAT_INTEL_MATCH", "description": "X", "severity": "CRITICAL"}]
    # TI score 40 alone drives verdict; level depends on total score
    score, level, verdict = calculate_risk(10, 0, 0, 0, 40, inds)
    assert verdict == "MALICIOUS"
    assert level in ("MEDIUM", "HIGH", "CRITICAL")  # confirmed malicious regardless of level


def test_score_capped_at_100():
    score, _, _ = calculate_risk(40, 30, 40, 30, 40, [])
    assert score == 100


def test_recommendations_ti_match():
    inds = [{"type": "THREAT_INTEL_MATCH", "description": "X", "severity": "CRITICAL"}]
    recs = build_recommendations("MALICIOUS", "CRITICAL", inds)
    assert any("즉시 접속을 중단" in r for r in recs)


def test_recommendations_brand_impersonation():
    inds = [{"type": "BRAND_IMPERSONATION", "description": "X", "severity": "HIGH"}]
    recs = build_recommendations("SUSPICIOUS", "HIGH", inds)
    assert any("공식 홈페이지" in r for r in recs)

"""Orchestrates all analysis engines for a single URL."""
import uuid
from typing import Any, Dict

from .schemas import (
    AnalyzeRequest, AnalyzeResponse, Indicator, DomainIntelligence,
    RedirectAnalysis, ThreatIntelResult, ModelInfo,
)
from .utils.url_normalizer import normalize_url, URLNormalizationError, extract_domain_info
from .engines.url_structure_engine import analyze_url_structure
from .engines.domain_intelligence_engine import analyze_domain_intelligence
from .engines.typosquatting_engine import analyze_typosquatting
from .engines.redirect_engine import analyze_redirects
from .engines.threat_intelligence_engine import analyze_threat_intelligence
from .engines.risk_engine import calculate_risk, build_evidence, build_recommendations


def analyze_url(req: AnalyzeRequest) -> AnalyzeResponse:
    # 1. Normalize
    try:
        normalized = normalize_url(req.url)
    except URLNormalizationError as e:
        return AnalyzeResponse(
            analysis_id=str(uuid.uuid4()),
            status="error",
            risk_score=0,
            risk_level="LOW",
            verdict="UNKNOWN",
            normalized_url=req.url,
            domain="",
            indicators=[],
            domain_intelligence=DomainIntelligence(dns_status="skipped", ssl_status="skipped"),
            redirect_analysis=RedirectAnalysis(checked=False, redirect_count=0, final_url=req.url, chain=[]),
            threat_intelligence=[],
            evidence=[f"URL 정규화 실패: {e}"],
            recommendations=["올바른 URL 형식인지 확인하십시오."],
            model_info=ModelInfo(),
            score_breakdown={},
        )

    ext = extract_domain_info(normalized)
    domain = f"{ext.domain}.{ext.suffix}" if ext.domain and ext.suffix else (ext.domain or "")

    all_indicators = []
    score_breakdown: Dict[str, int] = {}

    # 2. URL structure
    s_score, s_inds = analyze_url_structure(normalized)
    score_breakdown["url_structure"] = s_score
    all_indicators.extend(s_inds)

    # 3. Domain intelligence
    d_score, d_inds, d_info = analyze_domain_intelligence(
        normalized,
        check_ssl=req.options.check_ssl,
        check_dns=req.options.check_dns,
    )
    score_breakdown["domain_intelligence"] = d_score
    all_indicators.extend(d_inds)

    # 4. Typosquatting
    t_score, t_inds = analyze_typosquatting(normalized)
    score_breakdown["typosquatting"] = t_score
    all_indicators.extend(t_inds)

    # 5. Redirect analysis
    r_score, r_inds, r_info = (0, [], {
        "checked": False, "redirect_count": 0, "final_url": normalized, "chain": [normalized], "error": None
    })
    if req.options.check_redirects:
        r_score, r_inds, r_info = analyze_redirects(normalized)
        score_breakdown["redirect"] = r_score
        all_indicators.extend(r_inds)

    # 6. Threat intelligence
    ti_score, ti_inds, ti_results = (0, [], [])
    if req.options.check_threat_intelligence:
        ti_score, ti_inds, ti_results = analyze_threat_intelligence(normalized)
        score_breakdown["threat_intelligence"] = ti_score
        all_indicators.extend(ti_inds)

    # 7. Risk calculation
    risk_score, risk_level, verdict = calculate_risk(
        s_score, d_score, t_score, r_score, ti_score, all_indicators
    )
    evidence = build_evidence(all_indicators)
    recommendations = build_recommendations(verdict, risk_level, all_indicators)

    return AnalyzeResponse(
        analysis_id=str(uuid.uuid4()),
        status="success",
        risk_score=risk_score,
        risk_level=risk_level,
        verdict=verdict,
        normalized_url=normalized,
        domain=domain,
        indicators=[Indicator(**i) for i in all_indicators],
        domain_intelligence=DomainIntelligence(
            domain_age=d_info.get("domain_age"),
            dns_status=d_info.get("dns_status", "skipped"),
            ssl_status=d_info.get("ssl_status", "skipped"),
            whois_status=d_info.get("whois_status", "unavailable"),
            dns_records=d_info.get("dns_records"),
            ssl_details=d_info.get("ssl_details"),
        ),
        redirect_analysis=RedirectAnalysis(
            checked=r_info.get("checked", False),
            redirect_count=r_info.get("redirect_count", 0),
            final_url=r_info.get("final_url", normalized),
            chain=r_info.get("chain", [normalized]),
            error=r_info.get("error"),
        ),
        threat_intelligence=[ThreatIntelResult(**ti) for ti in ti_results],
        evidence=evidence,
        recommendations=recommendations,
        model_info=ModelInfo(engine="rule_based"),
        score_breakdown=score_breakdown,
    )

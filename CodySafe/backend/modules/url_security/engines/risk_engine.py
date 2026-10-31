"""Aggregate engine scores into final risk score, level, verdict, and recommendations."""
from typing import List, Dict, Any, Tuple


def _clamp(v: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, v))


def calculate_risk(
    structure_score: int,
    domain_score: int,
    typo_score: int,
    redirect_score: int,
    ti_score: int,
    all_indicators: List[dict],
) -> Tuple[int, str, str]:
    """Returns (risk_score 0-100, risk_level, verdict)."""
    raw = structure_score + domain_score + typo_score + redirect_score + ti_score
    risk_score = _clamp(raw, 0, 100)

    if risk_score >= 80:
        risk_level = "CRITICAL"
    elif risk_score >= 60:
        risk_level = "HIGH"
    elif risk_score >= 30:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    # Verdict: MALICIOUS only when TI confirms it; otherwise SUSPICIOUS or SAFE
    ti_confirmed = any(i["type"] == "THREAT_INTEL_MATCH" for i in all_indicators)
    ssrf_blocked = any(i["type"] in ("SSRF_BLOCKED", "SSRF_BLOCKED_REDIRECT") for i in all_indicators)

    if ti_confirmed or ssrf_blocked:
        verdict = "MALICIOUS"
    elif risk_score >= 30:
        verdict = "SUSPICIOUS"
    else:
        verdict = "SAFE"

    return risk_score, risk_level, verdict


def build_evidence(indicators: List[dict]) -> List[str]:
    return [ind["description"] for ind in indicators]


def build_recommendations(verdict: str, risk_level: str, indicators: List[dict]) -> List[str]:
    recs = []
    types = {i["type"] for i in indicators}

    if verdict in ("MALICIOUS", "SUSPICIOUS"):
        recs.append("해당 URL에 접속하지 마십시오.")
        recs.append("개인 정보, 계정 정보, 결제 정보를 절대 입력하지 마십시오.")

    if "BRAND_IMPERSONATION" in types or "TYPOSQUATTING" in types or "BRAND_IN_SUBDOMAIN" in types:
        recs.append("공식 홈페이지 주소를 직접 주소창에 입력하여 접속하십시오.")
        recs.append("검색 엔진을 통해 공식 사이트 주소를 확인하십시오.")

    if "URL_SHORTENER" in types:
        recs.append("URL 단축 서비스를 통해 제공된 링크는 실제 목적지를 확인한 후 접속하십시오.")

    if "HTTP_NOT_HTTPS" in types:
        recs.append("HTTPS를 사용하지 않는 사이트에서는 민감한 정보를 입력하지 마십시오.")

    if "SSL_INVALID" in types or "SSL_EXPIRED" in types:
        recs.append("SSL/TLS 인증서가 유효하지 않은 사이트는 접속을 피하십시오.")

    if "THREAT_INTEL_MATCH" in types:
        recs.append("이 URL은 보안 위협 인텔리전스 서비스에서 악성으로 분류되었습니다. 즉시 접속을 중단하십시오.")
        recs.append("이미 접속한 경우 비밀번호를 변경하고 보안 소프트웨어로 점검하십시오.")

    if not recs:
        recs.append("현재 탐지된 위험 요소가 없습니다. 그러나 항상 출처를 확인하고 신중하게 접속하십시오.")

    return recs

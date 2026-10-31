"""Aggregate Threat Intelligence results and convert to score contribution."""
from typing import List, Tuple, Dict, Any

from ..providers import ALL_PROVIDERS


def analyze_threat_intelligence(url: str) -> Tuple[int, List[dict], List[Dict[str, Any]]]:
    indicators: List[dict] = []
    score = 0
    ti_results = []

    for provider in ALL_PROVIDERS:
        result = provider.lookup(url)
        ti_results.append(result)

        if result.get("status") == "ok" and result.get("result"):
            if result["result"].get("malicious"):
                indicators.append({
                    "type": "THREAT_INTEL_MATCH",
                    "description": f"{result['provider']}에서 악성 URL로 탐지되었습니다.",
                    "severity": "CRITICAL",
                })
                score += 40  # confirmed malicious — max weight

    return min(score, 40), indicators, ti_results

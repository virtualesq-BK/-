from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator
import re


class AnalysisOptions(BaseModel):
    check_redirects: bool = True
    check_dns: bool = True
    check_ssl: bool = True
    check_threat_intelligence: bool = True


class AnalyzeRequest(BaseModel):
    url: str = Field(..., min_length=1, max_length=2048)
    options: AnalysisOptions = Field(default_factory=AnalysisOptions)

    @field_validator("url")
    @classmethod
    def url_must_have_scheme_or_host(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("URL must not be empty")
        return v


class Indicator(BaseModel):
    type: str
    description: str
    severity: str  # LOW / MEDIUM / HIGH / CRITICAL


class DomainIntelligence(BaseModel):
    domain_age: Optional[str] = None
    dns_status: str
    ssl_status: str
    whois_status: str = "unavailable"
    dns_records: Optional[Dict[str, Any]] = None
    ssl_details: Optional[Dict[str, Any]] = None


class RedirectAnalysis(BaseModel):
    checked: bool
    redirect_count: int
    final_url: str
    chain: List[str]
    error: Optional[str] = None


class ThreatIntelResult(BaseModel):
    provider: str
    status: str
    result: Optional[Dict[str, Any]] = None
    last_checked: Optional[str] = None
    error: Optional[str] = None


class ModelInfo(BaseModel):
    engine: str = "rule_based"
    models_used: List[str] = Field(default_factory=list)
    fallback_used: bool = False


class AnalyzeResponse(BaseModel):
    analysis_id: str
    module: str = "url_security"
    status: str
    risk_score: int
    risk_level: str
    verdict: str
    normalized_url: str
    domain: str
    indicators: List[Indicator]
    domain_intelligence: DomainIntelligence
    redirect_analysis: RedirectAnalysis
    threat_intelligence: List[ThreatIntelResult]
    evidence: List[str]
    recommendations: List[str]
    model_info: ModelInfo
    score_breakdown: Dict[str, int]


class HealthProvider(BaseModel):
    name: str
    configured: bool


class HealthResponse(BaseModel):
    module: str = "url_security"
    status: str = "ok"
    providers: List[HealthProvider]

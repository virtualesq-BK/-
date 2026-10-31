from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from .schemas import AnalyzeRequest, AnalyzeResponse, HealthResponse, HealthProvider
from .service import analyze_url
from .config import config
from .providers import ALL_PROVIDERS

router = APIRouter(prefix="/api/v1/url-security", tags=["URL Security"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/analyze", response_model=AnalyzeResponse)
@limiter.limit(f"{config.RATE_LIMIT_PER_MINUTE}/minute")
async def analyze(request: Request, body: AnalyzeRequest):
    try:
        return analyze_url(body)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health", response_model=HealthResponse)
async def health():
    providers = []
    for p in ALL_PROVIDERS:
        import os
        key_env = {
            "google_safe_browsing": "GOOGLE_SAFE_BROWSING_KEY",
            "virustotal": "VIRUSTOTAL_KEY",
            "urlhaus": None,  # public
            "phishtank": "PHISHTANK_KEY",
        }
        env_name = key_env.get(p.name)
        configured = (env_name is None) or bool(os.getenv(env_name))
        providers.append(HealthProvider(name=p.name, configured=configured))
    return HealthResponse(providers=providers)

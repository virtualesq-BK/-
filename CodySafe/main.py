"""Standalone FastAPI application for the URL Security module."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from backend.modules.url_security.router import router

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="CodySafe — URL Security Detection Module",
    description=(
        "독립형 URL 보안 분석 모듈. "
        "피싱, 타이포스쿼팅, 악성 리다이렉션, Threat Intelligence 연계를 제공합니다."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/", include_in_schema=False)
async def root():
    return {"module": "url_security", "status": "ok", "docs": "/docs"}

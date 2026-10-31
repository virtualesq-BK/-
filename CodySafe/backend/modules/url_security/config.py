import os
from typing import Optional


class URLSecurityConfig:
    # Threat Intelligence API keys (from environment)
    GOOGLE_SAFE_BROWSING_KEY: Optional[str] = os.getenv("GOOGLE_SAFE_BROWSING_KEY")
    VIRUSTOTAL_KEY: Optional[str] = os.getenv("VIRUSTOTAL_KEY")
    URLHAUS_KEY: Optional[str] = os.getenv("URLHAUS_KEY")  # optional; public API exists
    PHISHTANK_KEY: Optional[str] = os.getenv("PHISHTANK_KEY")

    # HTTP safety limits
    REDIRECT_MAX_FOLLOW: int = int(os.getenv("REDIRECT_MAX_FOLLOW", "5"))
    REQUEST_TIMEOUT_CONNECT: float = float(os.getenv("REQUEST_TIMEOUT_CONNECT", "5"))
    REQUEST_TIMEOUT_READ: float = float(os.getenv("REQUEST_TIMEOUT_READ", "10"))
    RESPONSE_MAX_BYTES: int = int(os.getenv("RESPONSE_MAX_BYTES", str(512 * 1024)))  # 512 KB

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))

    # Brands config file path (override via env)
    BRANDS_CONFIG_PATH: str = os.getenv(
        "BRANDS_CONFIG_PATH",
        os.path.join(os.path.dirname(__file__), "brands.json"),
    )


config = URLSecurityConfig()

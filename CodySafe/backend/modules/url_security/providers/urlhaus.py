import datetime
from typing import Any, Dict

import httpx

from .base import ThreatIntelProvider


class URLhausProvider(ThreatIntelProvider):
    name = "urlhaus"
    # URLhaus offers a free public API (no key required)
    _endpoint = "https://urlhaus-api.abuse.ch/v1/url/"

    def lookup(self, url: str) -> Dict[str, Any]:
        now = datetime.datetime.utcnow().isoformat() + "Z"
        try:
            r = httpx.post(
                self._endpoint,
                data={"url": url},
                timeout=10,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            r.raise_for_status()
            data = r.json()
            query_status = data.get("query_status", "")
            if query_status == "no_results":
                return {
                    "provider": self.name,
                    "status": "ok",
                    "result": {"malicious": False, "note": "No results in URLhaus"},
                    "last_checked": now,
                }
            malicious = query_status == "is_host"
            return {
                "provider": self.name,
                "status": "ok",
                "result": {
                    "malicious": malicious,
                    "query_status": query_status,
                    "urls_count": data.get("urls_count"),
                    "blacklists": data.get("blacklists"),
                },
                "last_checked": now,
            }
        except Exception as e:
            return {
                "provider": self.name,
                "status": "unavailable",
                "result": None,
                "error": str(e),
                "last_checked": now,
            }

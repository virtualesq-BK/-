import datetime
from typing import Any, Dict

import httpx

from ..config import config
from .base import ThreatIntelProvider


class PhishTankProvider(ThreatIntelProvider):
    name = "phishtank"
    _endpoint = "https://checkurl.phishtank.com/checkurl/"

    def lookup(self, url: str) -> Dict[str, Any]:
        now = datetime.datetime.utcnow().isoformat() + "Z"
        if not config.PHISHTANK_KEY:
            return {
                "provider": self.name,
                "status": "not_configured",
                "result": None,
                "last_checked": now,
            }
        try:
            import urllib.parse
            encoded_url = urllib.parse.quote(url, safe="")
            payload = {
                "url": encoded_url,
                "format": "json",
                "app_key": config.PHISHTANK_KEY,
            }
            r = httpx.post(self._endpoint, data=payload, timeout=10)
            r.raise_for_status()
            data = r.json()
            results = data.get("results", {})
            in_database = results.get("in_database", False)
            valid = results.get("valid", False)
            return {
                "provider": self.name,
                "status": "ok",
                "result": {
                    "malicious": in_database and valid,
                    "in_database": in_database,
                    "verified": valid,
                    "phish_detail_url": results.get("phish_detail_page"),
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

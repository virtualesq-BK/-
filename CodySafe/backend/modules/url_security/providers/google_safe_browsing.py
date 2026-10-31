import datetime
from typing import Any, Dict

import httpx

from ..config import config
from .base import ThreatIntelProvider


class GoogleSafeBrowsingProvider(ThreatIntelProvider):
    name = "google_safe_browsing"
    _endpoint = "https://safebrowsing.googleapis.com/v4/threatMatches:find"

    def lookup(self, url: str) -> Dict[str, Any]:
        now = datetime.datetime.utcnow().isoformat() + "Z"
        if not config.GOOGLE_SAFE_BROWSING_KEY:
            return {
                "provider": self.name,
                "status": "not_configured",
                "result": None,
                "last_checked": now,
            }

        payload = {
            "client": {"clientId": "codysafe", "clientVersion": "1.0"},
            "threatInfo": {
                "threatTypes": [
                    "MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE",
                    "POTENTIALLY_HARMFUL_APPLICATION",
                ],
                "platformTypes": ["ANY_PLATFORM"],
                "threatEntryTypes": ["URL"],
                "threatEntries": [{"url": url}],
            },
        }
        try:
            r = httpx.post(
                self._endpoint,
                params={"key": config.GOOGLE_SAFE_BROWSING_KEY},
                json=payload,
                timeout=10,
            )
            r.raise_for_status()
            data = r.json()
            matches = data.get("matches", [])
            return {
                "provider": self.name,
                "status": "ok",
                "result": {
                    "malicious": bool(matches),
                    "matches": matches,
                },
                "last_checked": now,
            }
        except Exception as e:
            return {
                "provider": self.name,
                "status": "error",
                "result": None,
                "error": str(e),
                "last_checked": now,
            }

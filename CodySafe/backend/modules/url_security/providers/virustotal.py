import base64
import datetime
from typing import Any, Dict

import httpx

from ..config import config
from .base import ThreatIntelProvider


class VirusTotalProvider(ThreatIntelProvider):
    name = "virustotal"
    _endpoint = "https://www.virustotal.com/api/v3/urls/{id}"

    def lookup(self, url: str) -> Dict[str, Any]:
        now = datetime.datetime.utcnow().isoformat() + "Z"
        if not config.VIRUSTOTAL_KEY:
            return {
                "provider": self.name,
                "status": "not_configured",
                "result": None,
                "last_checked": now,
            }

        url_id = base64.urlsafe_b64encode(url.encode()).rstrip(b"=").decode()
        try:
            r = httpx.get(
                self._endpoint.format(id=url_id),
                headers={"x-apikey": config.VIRUSTOTAL_KEY},
                timeout=15,
            )
            if r.status_code == 404:
                return {
                    "provider": self.name,
                    "status": "ok",
                    "result": {"malicious": False, "note": "Not found in VirusTotal database"},
                    "last_checked": now,
                }
            r.raise_for_status()
            data = r.json()
            stats = data.get("data", {}).get("attributes", {}).get("last_analysis_stats", {})
            malicious_count = stats.get("malicious", 0)
            return {
                "provider": self.name,
                "status": "ok",
                "result": {
                    "malicious": malicious_count > 0,
                    "malicious_count": malicious_count,
                    "stats": stats,
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

from abc import ABC, abstractmethod
from typing import Any, Dict


class ThreatIntelProvider(ABC):
    name: str = "base"

    @abstractmethod
    def lookup(self, url: str) -> Dict[str, Any]:
        """
        Returns a dict with at minimum:
          provider, status, result, last_checked
        """
        ...

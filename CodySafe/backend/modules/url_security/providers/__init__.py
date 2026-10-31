from .google_safe_browsing import GoogleSafeBrowsingProvider
from .virustotal import VirusTotalProvider
from .urlhaus import URLhausProvider
from .phishtank import PhishTankProvider

ALL_PROVIDERS = [
    GoogleSafeBrowsingProvider(),
    VirusTotalProvider(),
    URLhausProvider(),
    PhishTankProvider(),
]

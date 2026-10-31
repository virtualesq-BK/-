"""DNS, SSL, and domain age analysis."""
import ssl
import socket
import datetime
from typing import Optional, Tuple, List, Dict, Any
from urllib.parse import urlparse

import dns.resolver
import dns.exception


def _check_dns(hostname: str) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "a_records": [],
        "mx_records": [],
        "ns_records": [],
        "status": "available",
    }
    try:
        a = dns.resolver.resolve(hostname, "A", lifetime=5)
        result["a_records"] = [r.address for r in a]
    except dns.exception.DNSException:
        pass

    try:
        mx = dns.resolver.resolve(hostname, "MX", lifetime=5)
        result["mx_records"] = [str(r.exchange) for r in mx]
    except dns.exception.DNSException:
        pass

    try:
        ns = dns.resolver.resolve(hostname, "NS", lifetime=5)
        result["ns_records"] = [str(r.target) for r in ns]
    except dns.exception.DNSException:
        pass

    if not result["a_records"]:
        result["status"] = "no_a_record"

    return result


def _check_ssl(hostname: str, port: int = 443) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "status": "unchecked",
        "issuer": None,
        "subject": None,
        "not_before": None,
        "not_after": None,
        "days_until_expiry": None,
    }
    ctx = ssl.create_default_context()
    try:
        with socket.create_connection((hostname, port), timeout=5) as sock:
            with ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert = ssock.getpeercert()
                result["status"] = "valid"
                result["issuer"] = dict(x[0] for x in cert.get("issuer", []))
                result["subject"] = dict(x[0] for x in cert.get("subject", []))
                not_after_str = cert.get("notAfter", "")
                if not_after_str:
                    not_after = datetime.datetime.strptime(
                        not_after_str, "%b %d %H:%M:%S %Y %Z"
                    )
                    result["not_after"] = not_after.isoformat()
                    result["days_until_expiry"] = (
                        not_after - datetime.datetime.utcnow()
                    ).days
                not_before_str = cert.get("notBefore", "")
                if not_before_str:
                    not_before = datetime.datetime.strptime(
                        not_before_str, "%b %d %H:%M:%S %Y %Z"
                    )
                    result["not_before"] = not_before.isoformat()
    except ssl.SSLCertVerificationError:
        result["status"] = "invalid"
    except (socket.timeout, ConnectionRefusedError, OSError):
        result["status"] = "unreachable"
    except Exception:
        result["status"] = "error"
    return result


def analyze_domain_intelligence(url: str, check_ssl: bool = True, check_dns: bool = True) -> Tuple[int, List[dict], Dict[str, Any]]:
    parsed = urlparse(url)
    hostname = parsed.hostname or ""
    scheme = parsed.scheme.lower()
    port = parsed.port or (443 if scheme == "https" else 80)

    indicators = []
    score = 0
    info: Dict[str, Any] = {
        "domain_age": None,
        "whois_status": "unavailable",
        "dns_status": "skipped",
        "ssl_status": "skipped",
    }

    if check_dns and hostname:
        dns_info = _check_dns(hostname)
        info["dns_status"] = dns_info["status"]
        info["dns_records"] = dns_info
        if dns_info["status"] == "no_a_record":
            indicators.append({
                "type": "DNS_NO_A_RECORD",
                "description": "도메인에 대한 A 레코드가 없습니다. 비활성 또는 새로 생성된 도메인일 수 있습니다.",
                "severity": "MEDIUM",
            })
            score += 8

    if check_ssl and scheme == "https" and hostname:
        ssl_info = _check_ssl(hostname, port)
        info["ssl_status"] = ssl_info["status"]
        info["ssl_details"] = ssl_info
        if ssl_info["status"] == "invalid":
            indicators.append({
                "type": "SSL_INVALID",
                "description": "SSL/TLS 인증서가 유효하지 않습니다.",
                "severity": "HIGH",
            })
            score += 12
        elif ssl_info["status"] == "unreachable":
            info["ssl_status"] = "unreachable"
        elif ssl_info.get("days_until_expiry") is not None:
            if ssl_info["days_until_expiry"] < 0:
                indicators.append({
                    "type": "SSL_EXPIRED",
                    "description": "SSL/TLS 인증서가 만료되었습니다.",
                    "severity": "HIGH",
                })
                score += 15
            elif ssl_info["days_until_expiry"] < 7:
                indicators.append({
                    "type": "SSL_EXPIRING_SOON",
                    "description": f"SSL/TLS 인증서가 {ssl_info['days_until_expiry']}일 후 만료됩니다.",
                    "severity": "MEDIUM",
                })
                score += 5

    return min(score, 30), indicators, info

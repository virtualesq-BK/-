"""SSRF protection: block private/loopback/metadata IPs before any outbound request."""
import ipaddress
import socket
from typing import Optional

from ..utils.url_normalizer import is_ip_address


# Cloud metadata endpoints to block
METADATA_IPS = {
    ipaddress.ip_address("169.254.169.254"),  # AWS/GCP/Azure IMDS
    ipaddress.ip_address("fd00:ec2::254"),    # AWS IPv6 IMDS
}

BLOCKED_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("169.254.0.0/16"),   # link-local
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),    # CGNAT
]


class SSRFViolation(Exception):
    pass


def _is_blocked_ip(ip_str: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip_str)
    except ValueError:
        return False

    if addr in METADATA_IPS:
        return True
    for net in BLOCKED_NETWORKS:
        if addr in net:
            return True
    return False


def validate_hostname(hostname: str) -> None:
    """Raise SSRFViolation if hostname resolves to a blocked address."""
    if not hostname:
        raise SSRFViolation("Empty hostname")

    # Direct IP check
    if is_ip_address(hostname):
        clean = hostname.strip("[]")
        if _is_blocked_ip(clean):
            raise SSRFViolation(f"Blocked IP address: {hostname}")
        return

    # Resolve DNS — check all returned addresses
    try:
        results = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        raise SSRFViolation(f"DNS resolution failed for {hostname}: {exc}") from exc

    for res in results:
        ip_str = res[4][0]
        if _is_blocked_ip(ip_str):
            raise SSRFViolation(
                f"Hostname {hostname!r} resolves to blocked address {ip_str}"
            )

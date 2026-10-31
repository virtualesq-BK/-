"""SSRF protection tests — no real network calls."""
import pytest
from unittest.mock import patch

from backend.modules.url_security.utils.ssrf_guard import validate_hostname, SSRFViolation


BLOCKED_HOSTS = [
    ("127.0.0.1", None),
    ("localhost", [("", "", "", "", ("127.0.0.1", 0))]),
    ("169.254.169.254", None),
    ("10.0.0.1", None),
    ("172.16.0.1", None),
    ("192.168.1.1", None),
    ("0.0.0.0", None),
]


@pytest.mark.parametrize("host,gai_result", BLOCKED_HOSTS)
def test_blocked_addresses(host, gai_result):
    if gai_result:
        with patch("socket.getaddrinfo", return_value=gai_result):
            with pytest.raises(SSRFViolation):
                validate_hostname(host)
    else:
        with pytest.raises(SSRFViolation):
            validate_hostname(host)


def test_public_ip_allowed():
    # 8.8.8.8 is public — should not raise
    with patch("socket.getaddrinfo", return_value=[("", "", "", "", ("8.8.8.8", 0))]):
        validate_hostname("dns.google")  # mocked to return public IP


def test_dns_rebinding_blocked():
    """Simulate DNS rebinding: hostname resolves to private IP."""
    with patch(
        "socket.getaddrinfo",
        return_value=[("", "", "", "", ("192.168.1.100", 0))],
    ):
        with pytest.raises(SSRFViolation):
            validate_hostname("trusted.example.com")


def test_cloud_metadata_blocked():
    with pytest.raises(SSRFViolation):
        validate_hostname("169.254.169.254")


def test_empty_hostname_blocked():
    with pytest.raises(SSRFViolation):
        validate_hostname("")

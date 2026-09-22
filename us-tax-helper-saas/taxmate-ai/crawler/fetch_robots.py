"""Standalone script: fetch IRS.gov robots.txt and print its Disallow rules.

Usage:
    python -m crawler.fetch_robots
"""
from __future__ import annotations

import asyncio

import httpx

from . import config
from .robots import fetch_robots_txt


async def main() -> None:
    async with httpx.AsyncClient(follow_redirects=True) as client:
        raw_text, rules = await fetch_robots_txt(client)

    print(f"Fetched {config.BASE_URL}/robots.txt ({len(raw_text)} bytes)\n")
    print("Disallow rules (applicable to our user-agent):")
    if not rules.disallow:
        print("  (none)")
    for rule in rules.disallow:
        print(f"  Disallow: {rule}")

    print("\nAllow rules (applicable to our user-agent):")
    if not rules.allow:
        print("  (none)")
    for rule in rules.allow:
        print(f"  Allow: {rule}")


if __name__ == "__main__":
    asyncio.run(main())

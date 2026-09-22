"""robots.txt fetching and rule evaluation."""
from __future__ import annotations

import urllib.robotparser as robotparser
from dataclasses import dataclass, field

import httpx

from . import config


@dataclass
class RobotsRules:
    disallow: list[str] = field(default_factory=list)
    allow: list[str] = field(default_factory=list)
    parser: robotparser.RobotFileParser | None = None

    def is_allowed(self, url: str) -> bool:
        if self.parser is None:
            return True
        return self.parser.can_fetch(config.USER_AGENT, url)


async def fetch_robots_txt(client: httpx.AsyncClient) -> tuple[str, RobotsRules]:
    """Fetch and parse robots.txt, returning raw text and parsed rules."""
    url = f"{config.BASE_URL}/robots.txt"
    resp = await client.get(url, headers={"User-Agent": config.USER_AGENT}, timeout=config.REQUEST_TIMEOUT_SECONDS)
    resp.raise_for_status()
    raw_text = resp.text

    parser = robotparser.RobotFileParser()
    parser.parse(raw_text.splitlines())

    disallow: list[str] = []
    allow: list[str] = []
    current_agent_matches = False
    for line in raw_text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if ":" not in stripped:
            continue
        field_name, _, value = stripped.partition(":")
        field_name = field_name.strip().lower()
        value = value.strip()
        if field_name == "user-agent":
            current_agent_matches = value == "*" or value.lower() in config.USER_AGENT.lower()
        elif field_name == "disallow" and current_agent_matches and value:
            disallow.append(value)
        elif field_name == "allow" and current_agent_matches and value:
            allow.append(value)

    rules = RobotsRules(disallow=disallow, allow=allow, parser=parser)
    return raw_text, rules

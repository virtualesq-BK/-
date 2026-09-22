"""Filesystem storage helpers: HTML JSON records, PDF files, and the JSONL index."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from . import config


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Paths:
    root: Path
    html_dir: Path
    pdf_dir: Path
    index_path: Path

    @classmethod
    def create(cls, data_dir: str = config.DATA_DIR) -> "Paths":
        root = Path(data_dir)
        html_dir = root / config.HTML_SUBDIR
        pdf_dir = root / config.PDF_SUBDIR
        html_dir.mkdir(parents=True, exist_ok=True)
        pdf_dir.mkdir(parents=True, exist_ok=True)
        return cls(root=root, html_dir=html_dir, pdf_dir=pdf_dir, index_path=root / config.INDEX_FILENAME)


def load_existing_index(paths: Paths) -> dict[str, dict[str, Any]]:
    """Load existing index.jsonl into a dict keyed by normalized URL, for incremental runs."""
    records: dict[str, dict[str, Any]] = {}
    if not paths.index_path.exists():
        return records
    with paths.index_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            url = record.get("url")
            if url:
                records[url] = record
    return records


def load_existing_text_hashes(paths: Paths) -> set[str]:
    """Load text_sha256 values already recorded in index.jsonl, for incremental dedup."""
    hashes: set[str] = set()
    if not paths.index_path.exists():
        return hashes
    with paths.index_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            text_hash = record.get("text_sha256")
            if text_hash:
                hashes.add(text_hash)
    return hashes


class IndexWriter:
    """Append-only JSONL index writer."""

    def __init__(self, paths: Paths):
        self._path = paths.index_path
        self._file = self._path.open("a", encoding="utf-8")

    def write(self, record: dict[str, Any]) -> None:
        self._file.write(json.dumps(record, ensure_ascii=False) + "\n")
        self._file.flush()

    def close(self) -> None:
        self._file.close()


def save_html_record(paths: Paths, slug: str, record: dict[str, Any]) -> Path:
    path = paths.html_dir / f"{slug}.json"
    with path.open("w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
    return path


def save_pdf_file(paths: Paths, filename: str, content: bytes) -> Path:
    path = paths.pdf_dir / filename
    with path.open("wb") as f:
        f.write(content)
    return path


def save_pdf_metadata(paths: Paths, filename: str, record: dict[str, Any]) -> Path:
    meta_filename = filename[:-4] + ".json" if filename.lower().endswith(".pdf") else filename + ".json"
    path = paths.pdf_dir / meta_filename
    with path.open("w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
    return path

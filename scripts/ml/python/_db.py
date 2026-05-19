"""Shared DB helpers for the Python ML sidecar.

Reads DATABASE_URL from env. Uses psycopg v3. Connections are short-lived;
callers must `with connect() as conn:` so they get auto-rollback on error.
"""
from __future__ import annotations

import os
import sys
import json
from contextlib import contextmanager
from typing import Any, Iterator

import psycopg


def require_database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        emit({"stage": "skipped", "reason": "DATABASE_URL not set"})
        sys.exit(3)
    return url


@contextmanager
def connect() -> Iterator[psycopg.Connection]:
    url = require_database_url()
    conn = psycopg.connect(url, autocommit=False)
    try:
        yield conn
    finally:
        conn.close()


def emit(obj: dict[str, Any]) -> None:
    """Emit one JSON line on stdout. Caller in Node parses these."""
    sys.stdout.write(json.dumps(obj, default=str) + "\n")
    sys.stdout.flush()

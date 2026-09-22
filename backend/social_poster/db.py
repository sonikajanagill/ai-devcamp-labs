"""Local SQLite store for published posts.

Session state (agent.py's current_image_path/current_image_url) only lives
as long as the ADK session does — gone on backend restart, and PostGallery.tsx
had to reconstruct post<->image links by fuzzy-matching the live chat message
stream. This gives published posts a durable row instead, keyed by their own
id, so the frontend can just read it back rather than re-derive it.

Stdlib sqlite3 only — no new dependency, no server to run, matches the
"small local db" ask exactly.
"""

import datetime
import pathlib
import sqlite3
from typing import Optional

DB_PATH = pathlib.Path(__file__).resolve().parents[2] / "social_spark.db"


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform TEXT NOT NULL,
                text TEXT NOT NULL,
                image_path TEXT,
                image_url TEXT,
                post_url TEXT,
                created_at TEXT NOT NULL
            )
            """
        )


def save_post(
    platform: str,
    text: str,
    post_url: Optional[str],
    image_path: Optional[str] = None,
    image_url: Optional[str] = None,
) -> dict:
    """Records a successfully published post. Returns the saved row."""
    created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with _connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO posts (platform, text, image_path, image_url, post_url, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (platform, text, image_path, image_url, post_url, created_at),
        )
        return {
            "id": cursor.lastrowid,
            "platform": platform,
            "text": text,
            "image_path": image_path,
            "image_url": image_url,
            "post_url": post_url,
            "created_at": created_at,
        }


def list_posts(limit: int = 50) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM posts ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(row) for row in rows]


init_db()  # table must exist before any save_post/list_posts call

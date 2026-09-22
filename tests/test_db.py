"""Unit tests for backend/social_poster/db.py.

Runs against a throwaway sqlite file per test (monkeypatched DB_PATH), never
the real social_spark.db at the repo root.
"""

from backend.social_poster import db


def test_save_post_returns_the_saved_row(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "posts.db")
    db.init_db()

    saved = db.save_post(
        platform="linkedin",
        text="hello world",
        post_url="https://example.com/post/1",
        image_path="/tmp/img.png",
        image_url="https://example.com/img.png",
    )

    assert saved["id"] is not None
    assert saved["platform"] == "linkedin"
    assert saved["text"] == "hello world"
    assert saved["post_url"] == "https://example.com/post/1"
    assert saved["image_path"] == "/tmp/img.png"
    assert saved["image_url"] == "https://example.com/img.png"
    assert saved["created_at"]  # non-empty ISO timestamp


def test_save_post_defaults_image_fields_to_none(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "posts.db")
    db.init_db()

    saved = db.save_post(platform="x", text="no image here", post_url=None)

    assert saved["image_path"] is None
    assert saved["image_url"] is None
    assert saved["post_url"] is None


def test_list_posts_returns_newest_first(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "posts.db")
    db.init_db()

    for i in range(3):
        db.save_post(platform="linkedin", text=f"post {i}", post_url=None)

    posts = db.list_posts()

    assert [p["text"] for p in posts] == ["post 2", "post 1", "post 0"]


def test_list_posts_respects_limit(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "posts.db")
    db.init_db()

    for i in range(5):
        db.save_post(platform="linkedin", text=f"post {i}", post_url=None)

    posts = db.list_posts(limit=2)

    assert len(posts) == 2


def test_list_posts_empty_db_returns_empty_list(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "posts.db")
    db.init_db()

    assert db.list_posts() == []


def test_init_db_is_idempotent(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "posts.db")
    db.init_db()
    db.save_post(platform="linkedin", text="survives a second init_db", post_url=None)

    db.init_db()  # CREATE TABLE IF NOT EXISTS — must not wipe existing rows

    assert len(db.list_posts()) == 1

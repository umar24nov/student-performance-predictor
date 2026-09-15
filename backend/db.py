"""
AcademicAI — SQLite database layer
===================================
Tables:
  users       → id, name, email, pass_hash, created_at
  sessions    → token, user_id, created_at
  predictions → id, user_id, model, prediction, confidence,
                confidence_scores(JSON), features(JSON), created_at

Auth uses salted SHA-256 hashes + random bearer tokens.
"""

import os
import json
import hashlib
import secrets
import sqlite3

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DB_PATH    = os.path.join(BASE_DIR, "academicai.db")


def _conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = _conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            email       TEXT NOT NULL UNIQUE,
            pass_hash   TEXT NOT NULL,
            created_at  TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token      TEXT PRIMARY KEY,
            user_id    INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS predictions (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id            INTEGER,
            model              TEXT,
            prediction         TEXT NOT NULL,
            confidence         REAL,
            confidence_scores  TEXT,
            features           TEXT,
            created_at         TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    """)
    conn.commit()
    conn.close()


# ─── Password helpers ────────────────────────────────────────────────────────

def hash_password(password: str, salt: str) -> str:
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()


def create_user(name: str, email: str, password: str):
    """Create user. Returns (ok, user_or_error)."""
    if len(password) < 6:
        return False, "Password must be at least 6 characters."
    salt = secrets.token_hex(8)
    pass_hash = hash_password(password, salt)
    conn = _conn()
    try:
        cur = conn.execute(
            "INSERT INTO users (name, email, pass_hash, created_at) VALUES (?, ?, ?, datetime('now'))",
            (name.strip(), email.strip().lower(), f"{salt}:{pass_hash}"),
        )
        conn.commit()
        user_id = cur.lastrowid
        conn.close()
        return True, {"id": user_id, "name": name.strip(), "email": email.strip().lower()}
    except sqlite3.IntegrityError:
        conn.close()
        return False, "An account with that email already exists."


def verify_login(email: str, password: str):
    conn = _conn()
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),)).fetchone()
    conn.close()
    if row is None:
        return None
    salt, stored = row["pass_hash"].split(":")
    if hash_password(password, salt) == stored:
        return dict(row)
    return None


def create_session(user_id: int):
    token = secrets.token_hex(24)
    conn = _conn()
    conn.execute(
        "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, datetime('now'))",
        (token, user_id),
    )
    conn.commit()
    conn.close()
    return token


def user_by_token(token: str):
    conn = _conn()
    row = conn.execute(
        """SELECT u.id, u.name, u.email
           FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token = ?""",
        (token,),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def delete_session(token: str):
    conn = _conn()
    conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()


# ─── Predictions history ─────────────────────────────────────────────────────

def save_prediction(user_id, model, prediction, confidence, confidence_scores, features):
    conn = _conn()
    conn.execute(
        """INSERT INTO predictions
           (user_id, model, prediction, confidence, confidence_scores, features, created_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))""",
        (user_id, model, prediction, confidence,
         json.dumps(confidence_scores), json.dumps(features)),
    )
    conn.commit()
    conn.close()


def get_history(user_id, limit: int = 50):
    conn = _conn()
    rows = conn.execute(
        """SELECT id, model, prediction, confidence, confidence_scores, features, created_at
           FROM predictions WHERE user_id = ? ORDER BY id DESC LIMIT ?""",
        (user_id, limit),
    ).fetchall()
    conn.close()
    return [
        {
            **dict(r),
            "confidence_scores": json.loads(r["confidence_scores"] or "{}"),
            "features": json.loads(r["features"] or "{}"),
        }
        for r in rows
    ]


def get_users_count():
    conn = _conn()
    n = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    conn.close()
    return n


def get_predictions_count():
    conn = _conn()
    n = conn.execute("SELECT COUNT(*) FROM predictions").fetchone()[0]
    conn.close()
    return n


def get_prediction_distribution():
    conn = _conn()
    rows = conn.execute("SELECT prediction, COUNT(*) as cnt FROM predictions GROUP BY prediction").fetchall()
    conn.close()
    return {r["prediction"]: r["cnt"] for r in rows}
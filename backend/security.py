"""
SmartEng – Authentication and password security helpers.

Password hashing : PBKDF2-HMAC-SHA256 with a unique random salt per password.
                   Legacy plain SHA-256 hashes (from the original project) are
                   accepted transparently and upgraded on next login.
JWT              : HS256 signed tokens.  Secret and expiry are read from .env.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt

PBKDF2_ITERATIONS = int(os.getenv("PASSWORD_HASH_ITERATIONS", "310000"))
JWT_SECRET        = os.getenv("JWT_SECRET", "change-this-secret-in-production")
JWT_ALGORITHM     = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))  # 24 h


def hash_password(password: str) -> str:
    """Hash with PBKDF2-HMAC-SHA256 + unique random salt.  Format: pbkdf2_sha256$iter$salt$digest."""
    salt   = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        PBKDF2_ITERATIONS,
        base64.urlsafe_b64encode(salt).decode("ascii"),
        base64.urlsafe_b64encode(digest).decode("ascii"),
    )


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify PBKDF2 hash.  Falls back to legacy SHA-256 for old accounts."""
    if stored_hash.startswith("pbkdf2_sha256$"):
        try:
            _, iterations, salt_b64, digest_b64 = stored_hash.split("$", 3)
            salt     = base64.urlsafe_b64decode(salt_b64.encode("ascii"))
            expected = base64.urlsafe_b64decode(digest_b64.encode("ascii"))
            actual   = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iterations))
            return hmac.compare_digest(actual, expected)
        except (ValueError, TypeError):
            return False

    # Legacy SHA-256 (original project).  Accept once; caller upgrades the hash.
    legacy = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return hmac.compare_digest(legacy, stored_hash)


def needs_rehash(stored_hash: str) -> bool:
    """Return True if the hash uses the old SHA-256 scheme and should be upgraded."""
    return not stored_hash.startswith("pbkdf2_sha256$")


def create_access_token(user_id: int, session_id: int | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload: dict = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    if session_id is not None:
        payload["sid"] = str(session_id)
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

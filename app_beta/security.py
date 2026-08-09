"""Authentication and password security helpers for SmartEng."""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt

PBKDF2_ITERATIONS = int(os.getenv("PASSWORD_HASH_ITERATIONS", "310000"))
JWT_SECRET = os.getenv("JWT_SECRET", "change-this-secret-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))


def hash_password(password: str) -> str:
    """Hash a password with PBKDF2-HMAC-SHA256 and a unique random salt."""
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS
    )
    return "pbkdf2_sha256${}${}${}".format(
        PBKDF2_ITERATIONS,
        base64.urlsafe_b64encode(salt).decode("ascii"),
        base64.urlsafe_b64encode(digest).decode("ascii"),
    )


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a PBKDF2 password hash. Legacy SHA-256 is supported for migration."""
    if stored_hash.startswith("pbkdf2_sha256$"):
        try:
            _, iterations, salt_b64, digest_b64 = stored_hash.split("$", 3)
            salt = base64.urlsafe_b64decode(salt_b64.encode("ascii"))
            expected = base64.urlsafe_b64decode(digest_b64.encode("ascii"))
            actual = hashlib.pbkdf2_hmac(
                "sha256", password.encode("utf-8"), salt, int(iterations)
            )
            return hmac.compare_digest(actual, expected)
        except (ValueError, TypeError):
            return False

    # Existing project versions stored SHA-256. Keep compatibility so old users
    # can log in once and then be transparently upgraded to PBKDF2.
    legacy = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return hmac.compare_digest(legacy, stored_hash)


def needs_rehash(stored_hash: str) -> bool:
    return not stored_hash.startswith("pbkdf2_sha256$")


def create_access_token(user_id: int, session_id: int | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    if session_id is not None:
        payload["sid"] = str(session_id)
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

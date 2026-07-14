"""JWT token creation and decoding."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union

import jwt

from server.config import settings
from server.schemas.models import Role

logger = logging.getLogger(__name__)


def create_access_token(
    subject: str,
    email: str,
    role: Union[str, Role],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a signed JWT access token with embedded role claims.

    Args:
        subject: User id placed in the ``sub`` claim.
        email: User email claim.
        role: User role claim (string or ``Role`` enum).
        expires_delta: Optional custom lifetime. Defaults to
            ``settings.access_token_expire_minutes``.

    Returns:
        Encoded JWT string.
    """
    now = datetime.now(timezone.utc)
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    expire = now + expires_delta
    role_value = role.value if isinstance(role, Role) else role
    payload: dict[str, Any] = {
        "sub": subject,
        "email": email,
        "role": role_value,
        "exp": expire,
        "iat": now,
    }
    return jwt.encode(
        payload,
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str) -> dict[str, Any]:
    """Decode and verify a JWT access token.

    Args:
        token: The raw JWT string.

    Returns:
        Decoded payload dict.

    Raises:
        jwt.ExpiredSignatureError: If the token has expired.
        jwt.InvalidTokenError: If the token is malformed or the signature is invalid.
    """
    return jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
    )

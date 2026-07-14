"""Reusable FastAPI auth dependencies for RBAC."""

import logging
from collections.abc import Callable, Coroutine
from typing import Any, Union

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from server.schemas.models import ROLE_RANK, CurrentUser, Role
from server.security.jwt import decode_token

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> CurrentUser:
    """Decode JWT and return the authenticated user.

    Args:
        token: Bearer token extracted by ``OAuth2PasswordBearer``.

    Returns:
        ``CurrentUser`` built from JWT claims.

    Raises:
        HTTPException 401: If the token is missing, expired, or invalid.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        subject = payload.get("sub")
        email = payload.get("email")
        role_raw = payload.get("role")
        if not subject or not email or not role_raw:
            raise credentials_exception
        try:
            role = Role(role_raw)
        except ValueError as exc:
            raise credentials_exception from exc
        return CurrentUser(id=str(subject), email=str(email), role=role)
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def require_role(
    min_role: Union[str, Role],
) -> Callable[..., Coroutine[Any, Any, CurrentUser]]:
    """Factory returning a dependency that enforces a minimum role clearance.

    Args:
        min_role: Minimum role required (``Role`` or string value).

    Returns:
        An async FastAPI dependency that returns ``CurrentUser`` when authorized.

    Raises:
        HTTPException 401: Propagated from ``get_current_user`` when unauthenticated.
        HTTPException 403: When the user's role lacks the required clearance.
    """
    required = Role(min_role) if isinstance(min_role, str) else min_role

    async def _dependency(
        user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        """Check if the user's role meets the minimum clearance.

        Args:
            user: The current authenticated user from JWT.

        Returns:
            The ``CurrentUser`` if authorized.

        Raises:
            HTTPException 403: If the user's role lacks clearance.
        """
        user_rank = ROLE_RANK.get(user.role, -1)
        required_rank = ROLE_RANK.get(required, 999)
        if user_rank < required_rank:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Role '{user.role.value}' lacks clearance "
                    f"(requires '{required.value}')"
                ),
            )
        return user

    return _dependency

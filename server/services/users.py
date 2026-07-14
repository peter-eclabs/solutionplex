"""User service layer for auth operations."""

import logging
from typing import Any, Optional

from server.database import client
from server.schemas.models import Role, UserCreate
from server.security.passwords import hash_password

logger = logging.getLogger(__name__)


async def create_user(data: UserCreate) -> dict[str, Any]:
    """Create a new user with a hashed password.

    Defaults to the ``reader`` role when not overridden on ``UserCreate``.

    Args:
        data: Registration payload (email, password, optional role).

    Returns:
        The inserted user document including ``_id`` (no plaintext password).
    """
    role = data.role if data.role is not None else Role.READER
    doc: dict[str, Any] = {
        "email": data.email,
        "hashed_password": hash_password(data.password),
        "role": role.value if isinstance(role, Role) else role,
    }
    result = await client.users_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def get_user_by_email(email: str) -> Optional[dict[str, Any]]:
    """Look up a raw user document by email.

    Args:
        email: The email to search for.

    Returns:
        The user document dict, or None if not found.
    """
    return await client.users_col.find_one({"email": email})

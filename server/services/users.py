"""User service layer for auth operations."""

import logging
from typing import Any, Optional

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo import ReturnDocument

from server.database import client
from server.schemas.models import Role, UserCreate
from server.security.passwords import hash_password

logger = logging.getLogger(__name__)

SUPERADMIN_EMAIL = "peter.j@ecgroup-intl.com"
SUPERADMIN_PASSWORD = "Peter@123"


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


async def seed_superadmin() -> bool:
    """Idempotently ensure the static superadmin account exists.

    Creates ``peter.j@ecgroup-intl.com`` with role ``superadmin`` only when
    no user with that email exists. Does not overwrite existing accounts.

    Returns:
        True if a new superadmin document was inserted; False if already present.
    """
    existing = await client.users_col.find_one({"email": SUPERADMIN_EMAIL})
    if existing is not None:
        logger.info("Superadmin already present; skip seed")
        return False

    doc: dict[str, Any] = {
        "email": SUPERADMIN_EMAIL,
        "hashed_password": hash_password(SUPERADMIN_PASSWORD),
        "role": Role.SUPERADMIN.value,
    }
    await client.users_col.insert_one(doc)
    logger.info("Seeded superadmin account for %s", SUPERADMIN_EMAIL)
    return True


async def list_users() -> list[dict[str, Any]]:
    """Return all user documents (including hashed_password field).

    Callers must map to ``UserResponse`` so hashes never leave the API.

    Returns:
        List of raw user documents from MongoDB.
    """
    cursor = client.users_col.find({})
    return await cursor.to_list(length=None)


async def update_user_role(user_id: str, role: Role) -> dict[str, Any]:
    """Update a user's role with last-superadmin protection.

    Args:
        user_id: Hex string MongoDB ObjectId of the target user.
        role: New role to assign.

    Returns:
        The updated user document.

    Raises:
        HTTPException 400: Invalid ObjectId, or demoting the last superadmin.
        HTTPException 404: User not found.
    """
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user id",
        )
    oid = ObjectId(user_id)
    current = await client.users_col.find_one({"_id": oid})
    if current is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    current_role = current.get("role")
    if (
        current_role == Role.SUPERADMIN.value
        and role != Role.SUPERADMIN
    ):
        superadmin_count = await client.users_col.count_documents(
            {"role": Role.SUPERADMIN.value}
        )
        if superadmin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the last superadmin",
            )

    updated = await client.users_col.find_one_and_update(
        {"_id": oid},
        {"$set": {"role": role.value}},
        return_document=ReturnDocument.AFTER,
    )
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return updated


async def delete_user(user_id: str, actor_id: str) -> None:
    """Hard-delete a user account with self-delete protection.

    Args:
        user_id: Hex string MongoDB ObjectId of the target user.
        actor_id: Hex string MongoDB ObjectId of the acting superadmin.

    Raises:
        HTTPException 400: Invalid ObjectId, or attempting to remove self.
        HTTPException 404: User not found.
    """
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user id",
        )
    oid = ObjectId(user_id)
    if user_id == actor_id or (
        ObjectId.is_valid(actor_id) and oid == ObjectId(actor_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove your own account",
        )
    current = await client.users_col.find_one({"_id": oid})
    if current is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    result = await client.users_col.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

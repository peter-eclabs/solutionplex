"""Superadmin-only user administration endpoints."""

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from server.schemas.models import Role, UserResponse, UserRoleUpdate
from server.security.deps import require_role
from server.services import users as users_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get(
    "/users",
    response_model=List[UserResponse],
    dependencies=[Depends(require_role(Role.SUPERADMIN))],
    summary="List all users",
    description="Returns every user account (id, email, role). Superadmin only.",
)
async def list_users():
    """List all registered users.

    Returns:
        List of ``UserResponse`` (never includes hashed passwords).

    Raises:
        HTTPException 500: On unexpected server errors.
    """
    try:
        docs = await users_service.list_users()
        return docs
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to list users")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.patch(
    "/users/{user_id}",
    response_model=UserResponse,
    dependencies=[Depends(require_role(Role.SUPERADMIN))],
    summary="Update a user's role",
    description=(
        "Sets the role for the given user id. Superadmin only. "
        "Rejects demoting the last superadmin."
    ),
)
async def update_user_role(user_id: str, body: UserRoleUpdate):
    """Update the role of a single user.

    Args:
        user_id: Target user ObjectId hex string.
        body: Desired role payload.

    Returns:
        Updated ``UserResponse``.

    Raises:
        HTTPException 400/404: Propagated from the service layer.
        HTTPException 500: On unexpected server errors.
    """
    try:
        doc = await users_service.update_user_role(user_id, body.role)
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update user role")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e

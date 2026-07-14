"""Authentication endpoints: register, token (login), and current user."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from server.schemas.models import CurrentUser, Token, UserCreate, UserResponse
from server.security.deps import get_current_user
from server.security.jwt import create_access_token
from server.security.passwords import verify_password
from server.services import users as users_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="Creates a new user with the default 'reader' role.",
)
async def register(data: UserCreate):
    """Register a new user account.

    Args:
        data: Registration payload (email, password, optional role).

    Returns:
        The created user (public fields only).

    Raises:
        HTTPException 409: If the email is already registered.
        HTTPException 500: On unexpected server errors.
    """
    try:
        existing = await users_service.get_user_by_email(data.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )
        doc = await users_service.create_user(data)
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to register user")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.post(
    "/token",
    response_model=Token,
    summary="Authenticate and obtain JWT",
    description=(
        "OAuth2 password grant: form fields username (email) and password. "
        "Returns a Bearer access token with embedded role."
    ),
)
async def login(form: Annotated[OAuth2PasswordRequestForm, Depends()]):
    """Authenticate user and return a JWT access token.

    Args:
        form: OAuth2 password form (``username`` is the user's email).

    Returns:
        ``Token`` with ``access_token`` and ``token_type``.

    Raises:
        HTTPException 401: If credentials are invalid.
        HTTPException 500: On unexpected server errors.
    """
    try:
        user = await users_service.get_user_by_email(form.username)
        if not user or not verify_password(form.password, user["hashed_password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        token = create_access_token(
            subject=str(user["_id"]),
            email=user["email"],
            role=user["role"],
        )
        return {"access_token": token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Login failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.get(
    "/me",
    response_model=CurrentUser,
    summary="Get current user info",
    description="Returns the authenticated user derived from the JWT.",
)
async def get_me(user: CurrentUser = Depends(get_current_user)):
    """Return the current authenticated user.

    Args:
        user: Injected by ``get_current_user`` from the Bearer token.

    Returns:
        ``CurrentUser`` with id, email, and role.
    """
    return user

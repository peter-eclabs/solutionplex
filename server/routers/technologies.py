import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from server.schemas.models import (
    Role,
    TechnologyCreate,
    TechnologyResponse,
    TechnologyUpdate,
)
from server.security.deps import require_role
from server.services import technologies as service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/technologies", tags=["Technologies"])


@router.post(
    "/",
    response_model=TechnologyResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(Role.ADMIN))],
    summary="Create a new Technology card",
    description="Creates a new Technology card in the database.",
)
async def create_technology(data: TechnologyCreate):
    try:
        return await service.create_technology(data)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to create technology")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.get(
    "/",
    response_model=List[TechnologyResponse],
    dependencies=[Depends(require_role(Role.READER))],
    summary="List all Technologies",
    description="Retrieves a list of all Technology cards, optionally filtered by keyword.",
)
async def list_technologies(q: Optional[str] = None):
    try:
        return await service.list_technologies(q=q)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to list technologies")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.get(
    "/{id}",
    response_model=TechnologyResponse,
    dependencies=[Depends(require_role(Role.READER))],
    summary="Get Technology details",
    description="Retrieves details of a specific Technology card.",
)
async def get_technology(id: str):
    try:
        doc = await service.get_technology(id)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Technology not found",
            )
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to retrieve technology {id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.put(
    "/{id}",
    response_model=TechnologyResponse,
    dependencies=[Depends(require_role(Role.ADMIN))],
    summary="Update a Technology card",
    description="Updates the title and/or description of a Technology card.",
)
async def update_technology(id: str, data: TechnologyUpdate):
    try:
        doc = await service.update_technology(id, data)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Technology not found",
            )
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to update technology {id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.delete(
    "/{id}",
    dependencies=[Depends(require_role(Role.ADMIN))],
    summary="Delete a Technology card",
    description="Deletes a Technology card.",
)
async def delete_technology(id: str):
    try:
        deleted = await service.delete_technology(id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Technology not found"
            )
        return {"detail": "Technology deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to delete technology {id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e

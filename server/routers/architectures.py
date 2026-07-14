import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from server.schemas.models import (
    ArchitectureCreate,
    ArchitectureResponse,
    ArchitectureUpdate,
    Role,
)
from server.security.deps import require_role
from server.services import architectures as service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/architectures", tags=["Architecture"])


@router.post(
    "/",
    response_model=ArchitectureResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(Role.ADMIN))],
    summary="Create a new Architecture design",
    description="Creates a new Architecture card in the database.",
)
async def create_architecture(data: ArchitectureCreate):
    try:
        return await service.create_architecture(data)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to create architecture")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.get(
    "/",
    response_model=List[ArchitectureResponse],
    summary="List all Architecture patterns",
    description="Retrieves a list of all Architecture pattern cards, optionally filtered by keyword.",
)
async def list_architectures(q: Optional[str] = None):
    try:
        return await service.list_architectures(q=q)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to list architectures")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.get(
    "/{id}",
    response_model=ArchitectureResponse,
    summary="Get Architecture details",
    description="Retrieves details of a specific Architecture pattern card.",
)
async def get_architecture(id: str):
    try:
        doc = await service.get_architecture(id)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Architecture not found",
            )
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to retrieve architecture {id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.put(
    "/{id}",
    response_model=ArchitectureResponse,
    dependencies=[Depends(require_role(Role.ADMIN))],
    summary="Update an Architecture card",
    description="Updates the title and/or description of an Architecture card.",
)
async def update_architecture(id: str, data: ArchitectureUpdate):
    try:
        doc = await service.update_architecture(id, data)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Architecture not found",
            )
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to update architecture {id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.delete(
    "/{id}",
    dependencies=[Depends(require_role(Role.ADMIN))],
    summary="Delete an Architecture card",
    description="Deletes an Architecture card and detaches it from linked Solutions.",
)
async def delete_architecture(id: str):
    try:
        deleted = await service.delete_architecture(id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Architecture not found"
            )
        return {"detail": "Architecture deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to delete architecture {id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e

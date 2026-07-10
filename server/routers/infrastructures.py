import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, status

from server.schemas.models import InfrastructureCreate, InfrastructureResponse, InfrastructureUpdate
from server.services import infrastructures as service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/infrastructures", tags=["Infrastructure"])


@router.post(
    "/",
    response_model=InfrastructureResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new Infrastructure stack",
    description="Creates a new Infrastructure card in the database.",
)
async def create_infrastructure(data: InfrastructureCreate):
    try:
        return await service.create_infrastructure(data)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to create infrastructure")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.get(
    "/",
    response_model=List[InfrastructureResponse],
    summary="List all Infrastructure stacks",
    description="Retrieves a list of all Infrastructure stack cards, optionally filtered by keyword.",
)
async def list_infrastructures(q: Optional[str] = None):
    try:
        return await service.list_infrastructures(q=q)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to list infrastructures")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.get(
    "/{id}",
    response_model=InfrastructureResponse,
    summary="Get Infrastructure details",
    description="Retrieves details of a specific Infrastructure stack card.",
)
async def get_infrastructure(id: str):
    try:
        doc = await service.get_infrastructure(id)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Infrastructure not found",
            )
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to retrieve infrastructure {id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.put(
    "/{id}",
    response_model=InfrastructureResponse,
    summary="Update an Infrastructure card",
    description="Updates the title and/or description of an Infrastructure card.",
)
async def update_infrastructure(id: str, data: InfrastructureUpdate):
    try:
        doc = await service.update_infrastructure(id, data)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Infrastructure not found",
            )
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to update infrastructure {id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e

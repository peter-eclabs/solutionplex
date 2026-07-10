import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, status

from server.schemas.models import SolutionCreate, SolutionResponse, SolutionUpdate
from server.services import solutions as service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/solutions", tags=["Solutions"])


@router.post(
    "/",
    response_model=SolutionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new Solution linked to problems/architectures/infrastructures",
    description="Creates a new Solution card and validates linked problem, architectures, and infrastructures.",
)
async def create_solution(data: SolutionCreate):
    try:
        doc = await service.create_solution(data)
        return await service.get_solution(str(doc["_id"]))
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to create solution")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.get(
    "/",
    response_model=List[SolutionResponse],
    summary="List all Solutions",
    description="Retrieves a list of all Solution cards, optionally filtered by keyword.",
)
async def list_solutions(q: Optional[str] = None):
    try:
        return await service.list_solutions(q=q)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to list solutions")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.get(
    "/{id}",
    response_model=SolutionResponse,
    summary="Get Solution details",
    description="Retrieves details of a specific Solution card, fully populating references.",
)
async def get_solution(id: str):
    try:
        doc = await service.get_solution(id)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Solution not found",
            )
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to retrieve solution {id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.put(
    "/{id}",
    response_model=SolutionResponse,
    summary="Update a Solution card",
    description="Updates the title, description, or linked references of a Solution card.",
)
async def update_solution(id: str, data: SolutionUpdate):
    try:
        doc = await service.update_solution(id, data)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Solution not found"
            )
        return doc
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to update solution {id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.delete(
    "/{id}",
    summary="Delete a Solution card",
    description="Deletes a Solution card.",
)
async def delete_solution(id: str):
    try:
        deleted = await service.delete_solution(id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Solution not found"
            )
        return {"detail": "Solution deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to delete solution {id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, status

from server.schemas.models import ProblemCreate, ProblemResponse
from server.services import problems as service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/problems", tags=["Problems"])


@router.post(
    "/",
    response_model=ProblemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new Problem card",
    description="Creates a new Problem card in the database.",
)
async def create_problem(data: ProblemCreate):
    try:
        doc = await service.create_problem(data)
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to create problem")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.get(
    "/",
    response_model=List[ProblemResponse],
    summary="List all Problems",
    description="Retrieves a list of all Problem cards, optionally filtered by keyword.",
)
async def list_problems(q: Optional[str] = None):
    try:
        return await service.list_problems(q=q)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to list problems")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.get(
    "/{id}",
    response_model=ProblemResponse,
    summary="Get Problem details",
    description="Retrieves detail view for a specific Problem card.",
)
async def get_problem(id: str):
    try:
        doc = await service.get_problem(id)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found"
            )
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to retrieve problem {id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e

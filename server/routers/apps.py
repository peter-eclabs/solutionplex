import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, status

from server.schemas.models import AppCreate, AppResponse
from server.services import apps as service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/apps", tags=["Apps"])


@router.post(
    "/",
    response_model=AppResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new App card",
    description="Creates a new App card linked to a specific problem.",
)
async def create_app(data: AppCreate):
    try:
        doc = await service.create_app(data)
        return await service.get_app(str(doc["_id"]))
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to create app")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.get(
    "/",
    response_model=List[AppResponse],
    summary="List all Apps",
    description="Retrieves a list of all App cards, optionally filtered by keyword.",
)
async def list_apps(q: Optional[str] = None):
    try:
        return await service.list_apps(q=q)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to list apps")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.get(
    "/readme",
    summary="Fetch README markdown content for a given GitHub repository URL",
    description="Retrieves, decodes, and returns the README file content from the specified repository.",
)
async def fetch_readme(github_url: str):
    try:
        content = await service.fetch_readme(github_url)
        return {"readme_content": content}
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to fetch README")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e

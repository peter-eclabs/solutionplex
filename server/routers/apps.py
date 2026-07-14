import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from server.schemas.models import AppCreate, AppResponse, AppUpdate, Role
from server.security.deps import require_role
from server.services import apps as service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/apps", tags=["Apps"])


@router.post(
    "/",
    response_model=AppResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(Role.ADMIN))],
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


@router.get(
    "/{id}",
    response_model=AppResponse,
    summary="Get App details",
    description="Retrieves detail view for a specific App card.",
)
async def get_app(id: str):
    try:
        doc = await service.get_app(id)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="App not found"
            )
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to retrieve app {id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.put(
    "/{id}",
    response_model=AppResponse,
    dependencies=[Depends(require_role(Role.ADMIN))],
    summary="Update an App card",
    description="Updates the title, description, URLs, or linked problem of an App card.",
)
async def update_app(id: str, data: AppUpdate):
    try:
        doc = await service.update_app(id, data)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="App not found"
            )
        return doc
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to update app {id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.delete(
    "/{id}",
    dependencies=[Depends(require_role(Role.ADMIN))],
    summary="Delete an App card",
    description="Deletes an App prototype card.",
)
async def delete_app(id: str):
    try:
        deleted = await service.delete_app(id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="App not found"
            )
        return {"detail": "App deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to delete app {id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e

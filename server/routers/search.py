import logging
from typing import Any, List

from fastapi import APIRouter, HTTPException, Query

from server.services import (
    apps,
    architectures,
    infrastructures,
    problems,
    solutions,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/search", tags=["Search"])


@router.get(
    "/",
    summary="Scoped keyword search mapped to active client tabs",
    description="Performs keyword search on title and description, scoped to a single active client tab.",
)
async def search(
    q: str = Query(..., min_length=1),
    tab: str = Query(
        ..., pattern="^(problems|solutions|architecture|infrastructure|apps)$"
    ),
) -> Any:
    try:
        if tab == "problems":
            return await problems.list_problems(q=q)
        elif tab == "solutions":
            return await solutions.list_solutions(q=q)
        elif tab == "architecture":
            return await architectures.list_architectures(q=q)
        elif tab == "infrastructure":
            return await infrastructures.list_infrastructures(q=q)
        elif tab == "apps":
            return await apps.list_apps(q=q)
        else:
            raise HTTPException(status_code=400, detail="Invalid tab target")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Search process failed")
        raise HTTPException(status_code=500, detail="Internal server error") from e

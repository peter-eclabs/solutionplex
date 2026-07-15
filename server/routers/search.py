import logging
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, Query

from server.schemas.models import (
    AppResponse,
    ArchitectureResponse,
    InfrastructureResponse,
    ProblemResponse,
    Role,
    SolutionResponse,
    TechnologyResponse,
)
from server.security.deps import require_role
from server.services import (
    apps,
    architectures,
    infrastructures,
    problems,
    solutions,
    technologies,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/search", tags=["Search"])


@router.get(
    "/",
    dependencies=[Depends(require_role(Role.READER))],
    summary="Scoped keyword search mapped to active client tabs",
    description="Performs keyword search on title and description, scoped to a single active client tab.",
)
async def search(
    q: str = Query(..., min_length=1),
    tab: str = Query(
        ...,
        pattern="^(problems|solutions|architecture|technologies|infrastructure|apps)$",
    ),
) -> Any:
    try:
        if tab == "problems":
            res = await problems.list_problems(q=q)
            return [ProblemResponse.model_validate(r) for r in res]
        elif tab == "solutions":
            res = await solutions.list_solutions(q=q)
            return [SolutionResponse.model_validate(r) for r in res]
        elif tab == "architecture":
            res = await architectures.list_architectures(q=q)
            return [ArchitectureResponse.model_validate(r) for r in res]
        elif tab == "technologies":
            res = await technologies.list_technologies(q=q)
            return [TechnologyResponse.model_validate(r) for r in res]
        elif tab == "infrastructure":
            res = await infrastructures.list_infrastructures(q=q)
            return [InfrastructureResponse.model_validate(r) for r in res]
        elif tab == "apps":
            res = await apps.list_apps(q=q)
            return [AppResponse.model_validate(r) for r in res]
        else:
            raise HTTPException(status_code=400, detail="Invalid tab target")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Search process failed")
        raise HTTPException(status_code=500, detail="Internal server error") from e

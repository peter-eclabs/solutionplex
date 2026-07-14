import logging
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.database.client import ensure_indexes
from server.routers import (
    apps,
    architectures,
    auth,
    infrastructures,
    problems,
    search,
    solutions,
)
from server.services.users import seed_superadmin

# Logging config
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan: indexes + superadmin seed on startup.

    Args:
        app: The FastAPI application instance.

    Yields:
        Control to the running application.
    """
    await ensure_indexes()
    await seed_superadmin()
    yield


app = FastAPI(
    title="Solutionplex API",
    description="Internal knowledge base matching problems to architectures, infrastructures, and solutions",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration for client port
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include modular routers
app.include_router(auth.router)
app.include_router(problems.router)
app.include_router(architectures.router)
app.include_router(infrastructures.router)
app.include_router(solutions.router)
app.include_router(apps.router)
app.include_router(search.router)


@app.get("/", tags=["Health"], summary="Check health of server")
async def health():
    return {"status": "healthy", "service": "solutionplex-server"}

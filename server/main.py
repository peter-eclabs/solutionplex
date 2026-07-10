import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.routers import (
    apps,
    architectures,
    infrastructures,
    problems,
    search,
    solutions,
)

# Logging config
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Solutionplex API",
    description="Internal knowledge base matching problems to architectures, infrastructures, and solutions",
    version="1.0.0",
)

# CORS configuration for client port
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include modular routers
app.include_router(problems.router)
app.include_router(architectures.router)
app.include_router(infrastructures.router)
app.include_router(solutions.router)
app.include_router(apps.router)
app.include_router(search.router)


@app.get("/", tags=["Health"], summary="Check health of server")
async def health():
    return {"status": "healthy", "service": "solutionplex-server"}

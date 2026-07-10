# Phase 1: Backend API Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the FastAPI backend including database configuration, Pydantic schemas, CRUD services for entity validation, modular routers, and mocked unit tests.

**Architecture:** A Python FastAPI backend connecting to MongoDB using Motor. Business logic resides in `services/`, Pydantic models in `schemas/`, and routers in `routers/`.

**Tech Stack:** FastAPI, Motor (async MongoDB), Pydantic v2, uvicorn[standard], uv, pytest, pytest-asyncio, pydantic-settings, httpx.

---

### Task 1: Initialize Backend Dependencies
**Files:**
- `server/pyproject.toml` (Modify)

- [ ] Update `server/pyproject.toml` dependencies and dev tools to include `pydantic-settings`, `httpx`, `pytest`, and `pytest-asyncio`. Run `uv add pydantic-settings httpx` and `uv add --dev pytest pytest-asyncio` inside the `server/` directory.
  - Expected `pyproject.toml` content:
    ```toml
    [project]
    name = "solutionplex-server"
    version = "0.1.0"
    description = "Solutionplex backend API"
    readme = "README.md"
    requires-python = ">=3.13"
    dependencies = [
        "fastapi>=0.139.0",
        "motor>=3.7.1",
        "pydantic>=2.13.4",
        "pydantic-settings>=2.0.0",
        "httpx>=0.27.0",
        "uvicorn[standard]>=0.50.2",
    ]

    [dependency-groups]
    dev = [
        "pyright>=1.1.411",
        "pytest>=8.0.0",
        "pytest-asyncio>=0.23.0",
    ]
    ```
- [ ] Run the command:
  ```bash
  cd server
  uv sync
  uv run pyright
  ```
  Ensure the command completes successfully.
- [ ] Commit changes:
  ```bash
  git add pyproject.toml uv.lock
  git commit -m "chore: add backend dependencies for config, HTTP requests, and testing"
  ```

---

### Task 2: Environment Configuration and MongoDB Client
**Files:**
- `server/.env` (Create)
- `server/config.py` (Create)
- `server/database/client.py` (Create)

- [ ] Create `server/.env` file:
  ```env
  MONGODB_URL=mongodb://localhost:27017
  MONGODB_DB=solutionplex
  ```
- [ ] Create `server/config.py`:
  ```python
  from pydantic_settings import BaseSettings

  class Settings(BaseSettings):
      mongodb_url: str = "mongodb://localhost:27017"
      mongodb_db: str = "solutionplex"

      model_config = {
          "env_file": ".env",
          "env_file_encoding": "utf-8",
          "extra": "ignore"
      }

  settings = Settings()
  ```
- [ ] Create `server/database/client.py` to initialize the Motor client:
  ```python
  import logging
  from motor.motor_asyncio import AsyncIOMotorClient
  from server.config import settings

  logger = logging.getLogger(__name__)

  logger.info(f"Connecting to MongoDB at {settings.mongodb_url}")
  client = AsyncIOMotorClient(settings.mongodb_url)
  db = client[settings.mongodb_db]

  # Collections
  problems_col = db["problems"]
  solutions_col = db["solutions"]
  architectures_col = db["architectures"]
  infrastructures_col = db["infrastructures"]
  apps_col = db["apps"]
  ```
- [ ] Commit changes:
  ```bash
  git add .env config.py database/client.py
  git commit -m "feat: configure env settings and motor database client"
  ```

---

### Task 3: Pydantic v2 Schema Declarations
**Files:**
- `server/schemas/models.py` (Create)

- [ ] Create `server/schemas/models.py` containing custom `PyObjectId` serialization/validation logic and schema configurations for all entities:
  ```python
  from datetime import datetime
  from typing import Annotated, Any, List, Optional
  from bson import ObjectId
  from pydantic import BaseModel, BeforeValidator, Field, PlainSerializer

  def validate_object_id(v: Any) -> ObjectId:
      if isinstance(v, ObjectId):
          return v
      if isinstance(v, str) and ObjectId.is_valid(v):
          return ObjectId(v)
      raise ValueError("Invalid ObjectId")

  PyObjectId = Annotated[
      ObjectId,
      BeforeValidator(validate_object_id),
      PlainSerializer(lambda v: str(v), return_type=str)
  ]

  # Reference Types for populated responses
  class ProblemShort(BaseModel):
      id: str
      title: str

  class SolutionShort(BaseModel):
      id: str
      title: str

  class ArchitectureShort(BaseModel):
      id: str
      title: str

  class InfrastructureShort(BaseModel):
      id: str
      title: str

  # Problems
  class ProblemCreate(BaseModel):
      title: str = Field(..., min_length=1, max_length=100)
      description: str = Field(..., min_length=1)

  class ProblemResponse(BaseModel):
      id: PyObjectId = Field(alias="_id")
      title: str
      description: str
      solutions: List[SolutionShort] = []
      created_at: datetime
      updated_at: datetime

      model_config = {
          "populate_by_name": True,
          "arbitrary_types_allowed": True
      }

  # Architectures
  class ArchitectureCreate(BaseModel):
      title: str = Field(..., min_length=1, max_length=100)
      description: str = Field(..., min_length=1)

  class ArchitectureResponse(BaseModel):
      id: PyObjectId = Field(alias="_id")
      title: str
      description: str
      created_at: datetime
      updated_at: datetime

      model_config = {
          "populate_by_name": True,
          "arbitrary_types_allowed": True
      }

  # Infrastructures
  class InfrastructureCreate(BaseModel):
      title: str = Field(..., min_length=1, max_length=100)
      description: str = Field(..., min_length=1)

  class InfrastructureResponse(BaseModel):
      id: PyObjectId = Field(alias="_id")
      title: str
      description: str
      created_at: datetime
      updated_at: datetime

      model_config = {
          "populate_by_name": True,
          "arbitrary_types_allowed": True
      }

  # Solutions
  class SolutionCreate(BaseModel):
      title: str = Field(..., min_length=1, max_length=100)
      description: str = Field(..., min_length=1)
      problem_id: str
      architecture_ids: List[str] = []
      infrastructure_ids: List[str] = []

  class SolutionResponse(BaseModel):
      id: PyObjectId = Field(alias="_id")
      title: str
      description: str
      problem: Optional[ProblemShort] = None
      architectures: List[ArchitectureShort] = []
      infrastructures: List[InfrastructureShort] = []
      created_at: datetime
      updated_at: datetime

      model_config = {
          "populate_by_name": True,
          "arbitrary_types_allowed": True
      }

  # Apps
  class AppCreate(BaseModel):
      title: str = Field(..., min_length=1, max_length=100)
      description: str = Field(..., min_length=1)
      github_url: str = Field(..., min_length=1)
      live_url: Optional[str] = None
      problem_id: str

  class AppResponse(BaseModel):
      id: PyObjectId = Field(alias="_id")
      title: str
      description: str
      github_url: str
      live_url: Optional[str] = None
      problem: Optional[ProblemShort] = None
      created_at: datetime
      updated_at: datetime

      model_config = {
          "populate_by_name": True,
          "arbitrary_types_allowed": True
      }
  ```
- [ ] Commit schemas:
  ```bash
  git add schemas/models.py
  git commit -m "feat: implement Pydantic v2 schemas for all business entities"
  ```

---

### Task 4: Relational Database CRUD Services
**Files:**
- `server/services/problems.py` (Create)
- `server/services/architectures.py` (Create)
- `server/services/infrastructures.py` (Create)
- `server/services/solutions.py` (Create)
- `server/services/apps.py` (Create)

- [ ] Create `server/services/problems.py`:
  ```python
  from datetime import datetime
  from typing import List, Optional
  from bson import ObjectId
  from server.database.client import problems_col, solutions_col
  from server.schemas.models import ProblemCreate, ProblemResponse, SolutionShort

  async def create_problem(data: ProblemCreate) -> dict:
      doc = data.model_dump()
      doc["created_at"] = datetime.utcnow()
      doc["updated_at"] = doc["created_at"]
      result = await problems_col.insert_one(doc)
      doc["_id"] = result.inserted_id
      return doc

  async def get_problem(problem_id: str) -> Optional[dict]:
      if not ObjectId.is_valid(problem_id):
          return None
      doc = await problems_col.find_one({"_id": ObjectId(problem_id)})
      if not doc:
          return None
      
      # Resolve solutions associated with this problem
      solutions_cursor = solutions_col.find({"problem_id": ObjectId(problem_id)})
      solutions = await solutions_cursor.to_list(length=100)
      doc["solutions"] = [
          {"id": str(s["_id"]), "title": s["title"]} for s in solutions
      ]
      return doc

  async def list_problems(q: Optional[str] = None) -> List[dict]:
      filter_query = {}
      if q:
          filter_query = {
              "$or": [
                  {"title": {"$regex": q, "$options": "i"}},
                  {"description": {"$regex": q, "$options": "i"}}
              ]
          }
      cursor = problems_col.find(filter_query)
      problems = await cursor.to_list(length=100)
      
      for p in problems:
          solutions_cursor = solutions_col.find({"problem_id": p["_id"]})
          solutions = await solutions_cursor.to_list(length=100)
          p["solutions"] = [
              {"id": str(s["_id"]), "title": s["title"]} for s in solutions
          ]
      return problems
  ```
- [ ] Create `server/services/architectures.py`:
  ```python
  from datetime import datetime
  from typing import List, Optional
  from bson import ObjectId
  from server.database.client import architectures_col
  from server.schemas.models import ArchitectureCreate

  async def create_architecture(data: ArchitectureCreate) -> dict:
      doc = data.model_dump()
      doc["created_at"] = datetime.utcnow()
      doc["updated_at"] = doc["created_at"]
      result = await architectures_col.insert_one(doc)
      doc["_id"] = result.inserted_id
      return doc

  async def get_architecture(arch_id: str) -> Optional[dict]:
      if not ObjectId.is_valid(arch_id):
          return None
      return await architectures_col.find_one({"_id": ObjectId(arch_id)})

  async def list_architectures(q: Optional[str] = None) -> List[dict]:
      filter_query = {}
      if q:
          filter_query = {
              "$or": [
                  {"title": {"$regex": q, "$options": "i"}},
                  {"description": {"$regex": q, "$options": "i"}}
              ]
          }
      cursor = architectures_col.find(filter_query)
      return await cursor.to_list(length=100)
  ```
- [ ] Create `server/services/infrastructures.py`:
  ```python
  from datetime import datetime
  from typing import List, Optional
  from bson import ObjectId
  from server.database.client import infrastructures_col
  from server.schemas.models import InfrastructureCreate

  async def create_infrastructure(data: InfrastructureCreate) -> dict:
      doc = data.model_dump()
      doc["created_at"] = datetime.utcnow()
      doc["updated_at"] = doc["created_at"]
      result = await infrastructures_col.insert_one(doc)
      doc["_id"] = result.inserted_id
      return doc

  async def get_infrastructure(infra_id: str) -> Optional[dict]:
      if not ObjectId.is_valid(infra_id):
          return None
      return await infrastructures_col.find_one({"_id": ObjectId(infra_id)})

  async def list_infrastructures(q: Optional[str] = None) -> List[dict]:
      filter_query = {}
      if q:
          filter_query = {
              "$or": [
                  {"title": {"$regex": q, "$options": "i"}},
                  {"description": {"$regex": q, "$options": "i"}}
              ]
          }
      cursor = infrastructures_col.find(filter_query)
      return await cursor.to_list(length=100)
  ```
- [ ] Create `server/services/solutions.py` enforcing relationship integrity rules:
  ```python
  from datetime import datetime
  from typing import List, Optional
  from bson import ObjectId
  from server.database.client import solutions_col, problems_col, architectures_col, infrastructures_col
  from server.schemas.models import SolutionCreate

  async def create_solution(data: SolutionCreate) -> dict:
      # 1:1 problem relationship validation
      if not ObjectId.is_valid(data.problem_id):
          raise ValueError("Invalid problem_id")
      problem_exists = await problems_col.find_one({"_id": ObjectId(data.problem_id)})
      if not problem_exists:
          raise ValueError("Associated Problem not found")

      # 1:N architecture relationship validation
      arch_object_ids = []
      for a_id in data.architecture_ids:
          if not ObjectId.is_valid(a_id):
              raise ValueError(f"Invalid architecture_id: {a_id}")
          arch_exists = await architectures_col.find_one({"_id": ObjectId(a_id)})
          if not arch_exists:
              raise ValueError(f"Associated Architecture not found: {a_id}")
          arch_object_ids.append(ObjectId(a_id))

      # 1:N infrastructure relationship validation
      infra_object_ids = []
      for i_id in data.infrastructure_ids:
          if not ObjectId.is_valid(i_id):
              raise ValueError(f"Invalid infrastructure_id: {i_id}")
          infra_exists = await infrastructures_col.find_one({"_id": ObjectId(i_id)})
          if not infra_exists:
              raise ValueError(f"Associated Infrastructure not found: {i_id}")
          infra_object_ids.append(ObjectId(i_id))

      doc = {
          "title": data.title,
          "description": data.description,
          "problem_id": ObjectId(data.problem_id),
          "architecture_ids": arch_object_ids,
          "infrastructure_ids": infra_object_ids,
          "created_at": datetime.utcnow(),
          "updated_at": datetime.utcnow()
      }
      result = await solutions_col.insert_one(doc)
      doc["_id"] = result.inserted_id
      return doc

  async def populate_solution(s: dict) -> dict:
      # Resolve problem details
      prob = await problems_col.find_one({"_id": s["problem_id"]})
      s["problem"] = {"id": str(prob["_id"]), "title": prob["title"]} if prob else None

      # Resolve architecture details
      arch_cursor = architectures_col.find({"_id": {"$in": s.get("architecture_ids", [])}})
      archs = await arch_cursor.to_list(length=100)
      s["architectures"] = [{"id": str(a["_id"]), "title": a["title"]} for a in archs]

      # Resolve infrastructure details
      infra_cursor = infrastructures_col.find({"_id": {"$in": s.get("infrastructure_ids", [])}})
      infras = await infra_cursor.to_list(length=100)
      s["infrastructures"] = [{"id": str(i["_id"]), "title": i["title"]} for i in infras]
      return s

  async def get_solution(solution_id: str) -> Optional[dict]:
      if not ObjectId.is_valid(solution_id):
          return None
      s = await solutions_col.find_one({"_id": ObjectId(solution_id)})
      if not s:
          return None
      return await populate_solution(s)

  async def list_solutions(q: Optional[str] = None) -> List[dict]:
      filter_query = {}
      if q:
          filter_query = {
              "$or": [
                  {"title": {"$regex": q, "$options": "i"}},
                  {"description": {"$regex": q, "$options": "i"}}
              ]
          }
      cursor = solutions_col.find(filter_query)
      solutions = await cursor.to_list(length=100)
      
      resolved_list = []
      for s in solutions:
          resolved_list.append(await populate_solution(s))
      return resolved_list
  ```
- [ ] Create `server/services/apps.py`:
  ```python
  import re
  import base64
  import logging
  from datetime import datetime
  from typing import List, Optional
  from bson import ObjectId
  import httpx
  from server.database.client import apps_col, problems_col
  from server.schemas.models import AppCreate

  logger = logging.getLogger(__name__)

  async def create_app(data: AppCreate) -> dict:
      if not ObjectId.is_valid(data.problem_id):
          raise ValueError("Invalid problem_id")
      problem_exists = await problems_col.find_one({"_id": ObjectId(data.problem_id)})
      if not problem_exists:
          raise ValueError("Associated Problem not found")

      doc = {
          "title": data.title,
          "description": data.description,
          "github_url": data.github_url,
          "live_url": data.live_url,
          "problem_id": ObjectId(data.problem_id),
          "created_at": datetime.utcnow(),
          "updated_at": datetime.utcnow()
      }
      result = await apps_col.insert_one(doc)
      doc["_id"] = result.inserted_id
      return doc

  async def populate_app(a: dict) -> dict:
      prob = await problems_col.find_one({"_id": a["problem_id"]})
      a["problem"] = {"id": str(prob["_id"]), "title": prob["title"]} if prob else None
      return a

  async def get_app(app_id: str) -> Optional[dict]:
      if not ObjectId.is_valid(app_id):
          return None
      a = await apps_col.find_one({"_id": ObjectId(app_id)})
      if not a:
          return None
      return await populate_app(a)

  async def list_apps(q: Optional[str] = None) -> List[dict]:
      filter_query = {}
      if q:
          filter_query = {
              "$or": [
                  {"title": {"$regex": q, "$options": "i"}},
                  {"description": {"$regex": q, "$options": "i"}}
              ]
          }
      cursor = apps_col.find(filter_query)
      apps = await cursor.to_list(length=100)
      
      resolved_list = []
      for a in apps:
          resolved_list.append(await populate_app(a))
      return resolved_list

  def parse_github_url(url: str) -> tuple[str, str]:
      pattern = r"https?://github\.com/([^/]+)/([^/]+)/?.*"
      match = re.match(pattern, url)
      if not match:
          raise ValueError("Invalid GitHub URL format")
      owner = match.group(1)
      repo = match.group(2)
      if repo.endswith(".git"):
          repo = repo[:-4]
      return owner, repo

  async def fetch_readme(github_url: str) -> str:
      owner, repo = parse_github_url(github_url)
      api_url = f"https://api.github.com/repos/{owner}/{repo}/readme"
      
      headers = {"User-Agent": "Solutionplex-App"}
      async with httpx.AsyncClient() as client:
          response = await client.get(api_url, headers=headers)
          if response.status_code != 200:
              logger.error(f"GitHub API returned {response.status_code} for {api_url}")
              raise ValueError(f"Failed to fetch README from GitHub: {response.text}")
          
          data = response.json()
          content_b64 = data.get("content", "")
          decoded = base64.b64decode(content_b64).decode("utf-8")
          return decoded
  ```
- [ ] Commit CRUD services:
  ```bash
  git add services/
  git commit -m "feat: implement database CRUD services validating relational schemas"
  ```

---

### Task 5: Routing Framework
**Files:**
- `server/routers/problems.py` (Create)
- `server/routers/architectures.py` (Create)
- `server/routers/infrastructures.py` (Create)
- `server/routers/solutions.py` (Create)
- `server/routers/apps.py` (Create)
- `server/routers/search.py` (Create)

- [ ] Create `server/routers/problems.py`:
  ```python
  import logging
  from typing import List, Optional
  from fastapi import APIRouter, HTTPException, status
  from server.schemas.models import ProblemCreate, ProblemResponse
  from server.services import problems as service

  logger = logging.getLogger(__name__)
  router = APIRouter(prefix="/api/problems", tags=["Problems"])

  @router.post("/", response_model=ProblemResponse, status_code=status.HTTP_201_CREATED, summary="Create a new Problem card")
  async def create_problem(data: ProblemCreate):
      try:
          doc = await service.create_problem(data)
          return doc
      except Exception as e:
          logger.exception("Failed to create problem")
          raise HTTPException(status_code=500, detail="Internal server error")

  @router.get("/", response_model=List[ProblemResponse], summary="List all Problems")
  async def list_problems(q: Optional[str] = None):
      try:
          return await service.list_problems(q=q)
      except Exception as e:
          logger.exception("Failed to list problems")
          raise HTTPException(status_code=500, detail="Internal server error")

  @router.get("/{id}", response_model=ProblemResponse, summary="Get Problem details")
  async def get_problem(id: str):
      try:
          doc = await service.get_problem(id)
          if not doc:
              raise HTTPException(status_code=404, detail="Problem not found")
          return doc
      except HTTPException:
          raise
      except Exception as e:
          logger.exception(f"Failed to retrieve problem {id}")
          raise HTTPException(status_code=500, detail="Internal server error")
  ```
- [ ] Create `server/routers/architectures.py`:
  ```python
  import logging
  from typing import List, Optional
  from fastapi import APIRouter, HTTPException, status
  from server.schemas.models import ArchitectureCreate, ArchitectureResponse
  from server.services import architectures as service

  logger = logging.getLogger(__name__)
  router = APIRouter(prefix="/api/architectures", tags=["Architecture"])

  @router.post("/", response_model=ArchitectureResponse, status_code=status.HTTP_201_CREATED, summary="Create a new Architecture design")
  async def create_architecture(data: ArchitectureCreate):
      try:
          return await service.create_architecture(data)
      except Exception as e:
          logger.exception("Failed to create architecture")
          raise HTTPException(status_code=500, detail="Internal server error")

  @router.get("/", response_model=List[ArchitectureResponse], summary="List all Architecture patterns")
  async def list_architectures(q: Optional[str] = None):
      try:
          return await service.list_architectures(q=q)
      except Exception as e:
          logger.exception("Failed to list architectures")
          raise HTTPException(status_code=500, detail="Internal server error")

  @router.get("/{id}", response_model=ArchitectureResponse, summary="Get Architecture details")
  async def get_architecture(id: str):
      try:
          doc = await service.get_architecture(id)
          if not doc:
              raise HTTPException(status_code=404, detail="Architecture not found")
          return doc
      except HTTPException:
          raise
      except Exception as e:
          logger.exception(f"Failed to retrieve architecture {id}")
          raise HTTPException(status_code=500, detail="Internal server error")
  ```
- [ ] Create `server/routers/infrastructures.py`:
  ```python
  import logging
  from typing import List, Optional
  from fastapi import APIRouter, HTTPException, status
  from server.schemas.models import InfrastructureCreate, InfrastructureResponse
  from server.services import infrastructures as service

  logger = logging.getLogger(__name__)
  router = APIRouter(prefix="/api/infrastructures", tags=["Infrastructure"])

  @router.post("/", response_model=InfrastructureResponse, status_code=status.HTTP_201_CREATED, summary="Create a new Infrastructure stack")
  async def create_infrastructure(data: InfrastructureCreate):
      try:
          return await service.create_infrastructure(data)
      except Exception as e:
          logger.exception("Failed to create infrastructure")
          raise HTTPException(status_code=500, detail="Internal server error")

  @router.get("/", response_model=List[InfrastructureResponse], summary="List all Infrastructure stacks")
  async def list_infrastructures(q: Optional[str] = None):
      try:
          return await service.list_infrastructures(q=q)
      except Exception as e:
          logger.exception("Failed to list infrastructures")
          raise HTTPException(status_code=500, detail="Internal server error")

  @router.get("/{id}", response_model=InfrastructureResponse, summary="Get Infrastructure details")
  async def get_infrastructure(id: str):
      try:
          doc = await service.get_infrastructure(id)
          if not doc:
              raise HTTPException(status_code=404, detail="Infrastructure not found")
          return doc
      except HTTPException:
          raise
      except Exception as e:
          logger.exception(f"Failed to retrieve infrastructure {id}")
          raise HTTPException(status_code=500, detail="Internal server error")
  ```
- [ ] Create `server/routers/solutions.py`:
  ```python
  import logging
  from typing import List, Optional
  from fastapi import APIRouter, HTTPException, status
  from server.schemas.models import SolutionCreate, SolutionResponse
  from server.services import solutions as service

  logger = logging.getLogger(__name__)
  router = APIRouter(prefix="/api/solutions", tags=["Solutions"])

  @router.post("/", response_model=SolutionResponse, status_code=status.HTTP_201_CREATED, summary="Create a new Solution linked to problems/architectures/infrastructures")
  async def create_solution(data: SolutionCreate):
      try:
          doc = await service.create_solution(data)
          return await service.get_solution(str(doc["_id"]))
      except ValueError as ve:
          raise HTTPException(status_code=400, detail=str(ve))
      except Exception as e:
          logger.exception("Failed to create solution")
          raise HTTPException(status_code=500, detail="Internal server error")

  @router.get("/", response_model=List[SolutionResponse], summary="List all Solutions")
  async def list_solutions(q: Optional[str] = None):
      try:
          return await service.list_solutions(q=q)
      except Exception as e:
          logger.exception("Failed to list solutions")
          raise HTTPException(status_code=500, detail="Internal server error")

  @router.get("/{id}", response_model=SolutionResponse, summary="Get Solution details")
  async def get_solution(id: str):
      try:
          doc = await service.get_solution(id)
          if not doc:
              raise HTTPException(status_code=404, detail="Solution not found")
          return doc
      except HTTPException:
          raise
      except Exception as e:
          logger.exception(f"Failed to retrieve solution {id}")
          raise HTTPException(status_code=500, detail="Internal server error")
  ```
- [ ] Create `server/routers/apps.py`:
  ```python
  import logging
  from typing import List, Optional
  from fastapi import APIRouter, HTTPException, status
  from server.schemas.models import AppCreate, AppResponse
  from server.services import apps as service

  logger = logging.getLogger(__name__)
  router = APIRouter(prefix="/api/apps", tags=["Apps"])

  @router.post("/", response_model=AppResponse, status_code=status.HTTP_201_CREATED, summary="Create a new App card")
  async def create_app(data: AppCreate):
      try:
          doc = await service.create_app(data)
          return await service.get_app(str(doc["_id"]))
      except ValueError as ve:
          raise HTTPException(status_code=400, detail=str(ve))
      except Exception as e:
          logger.exception("Failed to create app")
          raise HTTPException(status_code=500, detail="Internal server error")

  @router.get("/", response_model=List[AppResponse], summary="List all Apps")
  async def list_apps(q: Optional[str] = None):
      try:
          return await service.list_apps(q=q)
      except Exception as e:
          logger.exception("Failed to list apps")
          raise HTTPException(status_code=500, detail="Internal server error")

  @router.get("/readme", summary="Fetch README markdown content for a given GitHub repository URL")
  async def fetch_readme(github_url: str):
      try:
          content = await service.fetch_readme(github_url)
          return {"readme_content": content}
      except ValueError as ve:
          raise HTTPException(status_code=400, detail=str(ve))
      except Exception as e:
          logger.exception("Failed to fetch README")
          raise HTTPException(status_code=500, detail="Internal server error")
  ```
- [ ] Create `server/routers/search.py`:
  ```python
  import logging
  from typing import Any, List
  from fastapi import APIRouter, HTTPException, Query
  from server.services import problems, solutions, architectures, infrastructures, apps

  logger = logging.getLogger(__name__)
  router = APIRouter(prefix="/api/search", tags=["Search"])

  @router.get("/", summary="Scoped keyword search mapped to active client tabs")
  async def search(
      q: str = Query(..., min_length=1),
      tab: str = Query(..., regex="^(problems|solutions|architecture|infrastructure|apps)$")
  ):
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
      except Exception as e:
          logger.exception("Search process failed")
          raise HTTPException(status_code=500, detail="Internal server error")
  ```
- [ ] Commit REST API routers:
  ```bash
  git add routers/
  git commit -m "feat: implement APIRouters for problems, solutions, architecture, infrastructure, apps, and search"
  ```

---

### Task 6: Main Entrypoint and Testing Configuration
**Files:**
- `server/main.py` (Modify)
- `server/tests/conftest.py` (Create)
- `server/tests/test_routers.py` (Create)

- [ ] Modify `server/main.py` to bootstrap FastAPI and mount routers and CORS:
  ```python
  import logging
  from fastapi import FastAPI
  from fastapi.middleware.cors import CORSMiddleware

  from server.routers import problems, architectures, infrastructures, solutions, apps, search

  # Logging config
  logging.basicConfig(level=logging.INFO)
  logger = logging.getLogger(__name__)

  app = FastAPI(
      title="Solutionplex API",
      description="Internal knowledge base matching problems to architectures, infrastructures, and solutions",
      version="1.0.0"
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

  @app.get("/", tags=["Health"])
  async def health():
      return {"status": "healthy", "service": "solutionplex-server"}
  ```
- [ ] Create `server/tests/conftest.py` containing mocked Motor client setup:
  ```python
  import pytest
  from unittest.mock import AsyncMock, MagicMock
  from fastapi.testclient import TestClient

  @pytest.fixture(autouse=True)
  def mock_db(monkeypatch):
      mock_db = MagicMock()
      
      # Set up mocked collections
      mock_db.problems = AsyncMock()
      mock_db.solutions = AsyncMock()
      mock_db.architectures = MagicMock() # Needs sub-attributes to be mocked
      mock_db.infrastructures = MagicMock()
      mock_db.apps = AsyncMock()
      
      # Mock the client module-level db reference
      monkeypatch.setattr("server.database.client.problems_col", mock_db.problems)
      monkeypatch.setattr("server.database.client.solutions_col", mock_db.solutions)
      monkeypatch.setattr("server.database.client.architectures_col", mock_db.architectures)
      monkeypatch.setattr("server.database.client.infrastructures_col", mock_db.infrastructures)
      monkeypatch.setattr("server.database.client.apps_col", mock_db.apps)
      
      return mock_db

  @pytest.fixture
  def client():
      from server.main import app
      return TestClient(app)
  ```
- [ ] Create `server/tests/test_routers.py` targeting endpoints with mocked behavior:
  ```python
  from bson import ObjectId
  from datetime import datetime

  def test_health(client):
      res = client.get("/")
      assert res.status_code == 200
      assert res.json() == {"status": "healthy", "service": "solutionplex-server"}

  def test_create_problem_router(client, mock_db):
      mock_db.problems.insert_one = AsyncMock(
          return_value=type("Result", (object,), {"inserted_id": ObjectId("60b8d5a1b55a8b0c848b4567")})()
      )
      # Simulating no active solution associated initially
      mock_solutions_cursor = AsyncMock()
      mock_solutions_cursor.to_list = AsyncMock(return_value=[])
      mock_db.solutions.find.return_value = mock_solutions_cursor

      res = client.post("/api/problems/", json={"title": "DB Lock", "description": "Slow write lockouts"})
      assert res.status_code == 201
      data = res.json()
      assert data["title"] == "DB Lock"
      assert data["id"] == "60b8d5a1b55a8b0c848b4567"
  ```
- [ ] Run backend validation commands to ensure tests and type-check are clean:
  ```bash
  cd server
  uv run pytest
  uv run pyright
  ```
- [ ] Commit core entrypoint and mock router test files:
  ```bash
  git add main.py tests/
  git commit -m "feat: configure main application entrypoint, CORS middleware, and mock tests"
  ```

from datetime import datetime
from enum import Enum
from typing import Annotated, Any, List, Optional

from bson import ObjectId
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, PlainSerializer


def validate_object_id(v: Any) -> ObjectId:
    if isinstance(v, ObjectId):
        return v
    if isinstance(v, str) and ObjectId.is_valid(v):
        return ObjectId(v)
    raise ValueError("Invalid ObjectId")


PyObjectId = Annotated[
    ObjectId,
    BeforeValidator(validate_object_id),
    PlainSerializer(lambda v: str(v), return_type=str),
]


# ── Auth / RBAC ──────────────────────────────────────────────────


class Role(str, Enum):
    """User roles ordered by clearance level.

    Admin and SuperAdmin share permissions today but are modelled as distinct
    values for future divergence (goal doc §2).
    """

    READER = "reader"
    ADMIN = "admin"
    SUPERADMIN = "superadmin"


ROLE_RANK: dict[Role, int] = {
    Role.READER: 0,
    Role.ADMIN: 1,
    Role.SUPERADMIN: 2,
}


class CurrentUser(BaseModel):
    """Authenticated user derived from JWT claims (never includes password)."""

    id: str
    email: str
    role: Role


class UserCreate(BaseModel):
    """Payload for creating a user account."""

    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    role: Role = Role.READER


class UserInDB(BaseModel):
    """User document as stored in MongoDB (includes hashed password)."""

    id: PyObjectId = Field(alias="_id", serialization_alias="id")
    email: str
    hashed_password: str
    role: Role

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        from_attributes=True,
    )


class UserResponse(BaseModel):
    """Public-facing user representation (never includes hashed_password)."""

    id: PyObjectId = Field(alias="_id", serialization_alias="id")
    email: str
    role: Role

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        from_attributes=True,
    )


class Token(BaseModel):
    """OAuth2-style access token response."""

    access_token: str
    token_type: str = "bearer"


# Reference Types for populated responses
class ProblemShort(BaseModel):
    id: str
    code: Optional[str] = None
    title: str


class SolutionShort(BaseModel):
    id: str
    code: Optional[str] = None
    title: str


class ArchitectureShort(BaseModel):
    id: str
    code: Optional[str] = None
    title: str


class InfrastructureShort(BaseModel):
    id: str
    code: Optional[str] = None
    title: str


class AppShort(BaseModel):
    id: str
    code: Optional[str] = None
    title: str
    created_at: Optional[datetime] = None


# Problems
class ProblemCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1)


class ProblemUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, min_length=1)


class ProblemResponse(BaseModel):
    id: PyObjectId = Field(alias="_id", serialization_alias="id")
    code: Optional[str] = None
    title: str
    description: str
    solutions: List[SolutionShort] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        from_attributes=True,
    )


# Architectures
class ArchitectureCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1)


class ArchitectureUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, min_length=1)


class ArchitectureResponse(BaseModel):
    id: PyObjectId = Field(alias="_id", serialization_alias="id")
    code: Optional[str] = None
    title: str
    description: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        from_attributes=True,
    )


# Infrastructures
class InfrastructureCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1)


class InfrastructureUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, min_length=1)


class InfrastructureResponse(BaseModel):
    id: PyObjectId = Field(alias="_id", serialization_alias="id")
    code: Optional[str] = None
    title: str
    description: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        from_attributes=True,
    )


# Solutions
class SolutionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1)
    problem_id: str
    architecture_ids: List[str] = []
    infrastructure_ids: List[str] = []


class SolutionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, min_length=1)
    problem_id: Optional[str] = None
    architecture_ids: Optional[List[str]] = None
    infrastructure_ids: Optional[List[str]] = None


class SolutionResponse(BaseModel):
    id: PyObjectId = Field(alias="_id", serialization_alias="id")
    title: str
    description: str
    problem: Optional[ProblemShort] = None
    # Solution-owned labels (used for edit forms and ownership)
    architectures: List[ArchitectureShort] = []
    infrastructures: List[InfrastructureShort] = []
    # Card preview: solution-owned ∪ linked apps' stored labels (display only)
    effective_architectures: List[ArchitectureShort] = []
    effective_infrastructures: List[InfrastructureShort] = []
    apps: List[AppShort] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        from_attributes=True,
    )


# Apps
class AppCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1)
    github_url: str = Field(..., min_length=1)
    live_url: Optional[str] = None
    solution_id: Optional[str] = None
    architecture_ids: List[str] = []
    infrastructure_ids: List[str] = []


class AppUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, min_length=1)
    github_url: Optional[str] = Field(None, min_length=1)
    live_url: Optional[str] = None
    solution_id: Optional[str] = None
    architecture_ids: Optional[List[str]] = None
    infrastructure_ids: Optional[List[str]] = None


class AppResponse(BaseModel):
    id: PyObjectId = Field(alias="_id", serialization_alias="id")
    code: Optional[str] = None
    title: str
    description: str
    github_url: str
    live_url: Optional[str] = None
    problem: Optional[ProblemShort] = None
    solutions: List[SolutionShort] = []
    solution: Optional[SolutionShort] = None
    architectures: List[ArchitectureShort] = []
    infrastructures: List[InfrastructureShort] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        from_attributes=True,
    )

from datetime import datetime
from typing import List, Optional

from bson import ObjectId

from server.database import client
from server.schemas.models import CurrentUser, Role, SolutionCreate, SolutionUpdate
from server.services.apps import _resolve_label_docs, _union_ref_ids
from server.services.visibility import hidden_problem_ids


async def create_solution(data: SolutionCreate) -> dict:
    # 1:1 problem relationship validation
    if not ObjectId.is_valid(data.problem_id):
        raise ValueError("Invalid problem_id")
    problem_exists = await client.problems_col.find_one(
        {"_id": ObjectId(data.problem_id)}
    )
    if not problem_exists:
        raise ValueError("Associated Problem not found")

    # 1:N architecture relationship validation
    arch_object_ids = []
    for a_id in data.architecture_ids:
        if not ObjectId.is_valid(a_id):
            raise ValueError(f"Invalid architecture_id: {a_id}")
        arch_exists = await client.architectures_col.find_one(
            {"_id": ObjectId(a_id)}
        )
        if not arch_exists:
            raise ValueError(f"Associated Architecture not found: {a_id}")
        arch_object_ids.append(ObjectId(a_id))

    # 1:N technology relationship validation
    tech_object_ids = []
    for t_id in data.technology_ids:
        if not ObjectId.is_valid(t_id):
            raise ValueError(f"Invalid technology_id: {t_id}")
        tech_exists = await client.technologies_col.find_one(
            {"_id": ObjectId(t_id)}
        )
        if not tech_exists:
            raise ValueError(f"Associated Technology not found: {t_id}")
        tech_object_ids.append(ObjectId(t_id))

    # 1:N infrastructure relationship validation
    infra_object_ids = []
    for i_id in data.infrastructure_ids:
        if not ObjectId.is_valid(i_id):
            raise ValueError(f"Invalid infrastructure_id: {i_id}")
        infra_exists = await client.infrastructures_col.find_one(
            {"_id": ObjectId(i_id)}
        )
        if not infra_exists:
            raise ValueError(f"Associated Infrastructure not found: {i_id}")
        infra_object_ids.append(ObjectId(i_id))

    doc = {
        "title": data.title,
        "description": data.description,
        "problem_id": ObjectId(data.problem_id),
        "architecture_ids": arch_object_ids,
        "technology_ids": tech_object_ids,
        "infrastructure_ids": infra_object_ids,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await client.solutions_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def populate_solution(s: dict) -> dict:
    # Resolve problem details
    prob = await client.problems_col.find_one({"_id": s["problem_id"]})
    s["problem"] = (
        {"id": str(prob["_id"]), "code": prob.get("code"), "title": prob["title"]}
        if prob
        else None
    )
    s["hidden"] = bool(prob and prob.get("hidden"))

    own_arch = s.get("architecture_ids") or []
    own_tech = s.get("technology_ids") or []
    own_infra = s.get("infrastructure_ids") or []

    # Solution-owned labels (edit forms / ownership — not expanded by apps)
    s["architectures"] = await _resolve_label_docs(
        _union_ref_ids(own_arch), client.architectures_col
    )
    s["technologies"] = await _resolve_label_docs(
        _union_ref_ids(own_tech), client.technologies_col
    )
    s["infrastructures"] = await _resolve_label_docs(
        _union_ref_ids(own_infra), client.infrastructures_col
    )

    # Resolve apps referencing this solution
    app_cursor = client.apps_col.find({"solution_id": s["_id"]})
    apps = await app_cursor.to_list(length=100)
    s["apps"] = [
        {
            "id": str(a["_id"]),
            "code": a.get("code"),
            "title": a["title"],
            "created_at": a.get("created_at"),
            "hidden": bool(prob and prob.get("hidden")),
        }
        for a in apps
    ]

    # Card preview: solution-owned ∪ each linked app's stored labels (display only).
    # App documents are not modified when linking.
    app_arch_lists = [a.get("architecture_ids") or [] for a in apps]
    app_tech_lists = [a.get("technology_ids") or [] for a in apps]
    app_infra_lists = [a.get("infrastructure_ids") or [] for a in apps]
    s["effective_architectures"] = await _resolve_label_docs(
        _union_ref_ids(own_arch, *app_arch_lists),
        client.architectures_col,
    )
    s["effective_technologies"] = await _resolve_label_docs(
        _union_ref_ids(own_tech, *app_tech_lists),
        client.technologies_col,
    )
    s["effective_infrastructures"] = await _resolve_label_docs(
        _union_ref_ids(own_infra, *app_infra_lists),
        client.infrastructures_col,
    )
    return s


async def get_solution(solution_id: str, current_user: Optional[CurrentUser] = None) -> Optional[dict]:
    if not ObjectId.is_valid(solution_id):
        return None
    s = await client.solutions_col.find_one({"_id": ObjectId(solution_id)})
    if not s:
        return None
    if current_user is not None and current_user.role == Role.READER:
        prob = await client.problems_col.find_one({"_id": s["problem_id"]})
        if prob and prob.get("hidden") is True:
            from fastapi import HTTPException, status

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This solution is hidden from readers",
            )
    return await populate_solution(s)


async def list_solutions(q: Optional[str] = None, current_user: Optional[CurrentUser] = None) -> List[dict]:
    filter_query = {}
    if q:
        filter_query = {
            "$or": [
                {"title": {"$regex": q, "$options": "i"}},
                {"description": {"$regex": q, "$options": "i"}},
            ]
        }
    cursor = client.solutions_col.find(filter_query)
    solutions = await cursor.to_list(length=100)

    hidden_ids = set()
    if current_user is not None and current_user.role == Role.READER:
        hidden_ids = await hidden_problem_ids()
        solutions = [s for s in solutions if str(s.get("problem_id")) not in hidden_ids]

    resolved_list = []
    for s in solutions:
        resolved = await populate_solution(s)
        if current_user is not None and current_user.role == Role.READER:
            resolved["hidden"] = str(s.get("problem_id")) in hidden_ids
        resolved_list.append(resolved)
    return resolved_list


async def update_solution(solution_id: str, data: SolutionUpdate) -> Optional[dict]:
    if not ObjectId.is_valid(solution_id):
        return None
    existing = await client.solutions_col.find_one({"_id": ObjectId(solution_id)})
    if not existing:
        return None

    update_fields = {
        k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None
    }

    if "problem_id" in update_fields:
        if not ObjectId.is_valid(update_fields["problem_id"]):
            raise ValueError("Invalid problem_id")
        prob = await client.problems_col.find_one(
            {"_id": ObjectId(update_fields["problem_id"])}
        )
        if not prob:
            raise ValueError("Associated Problem not found")
        update_fields["problem_id"] = ObjectId(update_fields["problem_id"])

    if "architecture_ids" in update_fields:
        arch_object_ids = []
        for a_id in update_fields["architecture_ids"]:
            if not ObjectId.is_valid(a_id):
                raise ValueError(f"Invalid architecture_id: {a_id}")
            arch_exists = await client.architectures_col.find_one(
                {"_id": ObjectId(a_id)}
            )
            if not arch_exists:
                raise ValueError(f"Associated Architecture not found: {a_id}")
            arch_object_ids.append(ObjectId(a_id))
        update_fields["architecture_ids"] = arch_object_ids

    if "technology_ids" in update_fields:
        tech_object_ids = []
        for t_id in update_fields["technology_ids"]:
            if not ObjectId.is_valid(t_id):
                raise ValueError(f"Invalid technology_id: {t_id}")
            tech_exists = await client.technologies_col.find_one(
                {"_id": ObjectId(t_id)}
            )
            if not tech_exists:
                raise ValueError(f"Associated Technology not found: {t_id}")
            tech_object_ids.append(ObjectId(t_id))
        update_fields["technology_ids"] = tech_object_ids

    if "infrastructure_ids" in update_fields:
        infra_object_ids = []
        for i_id in update_fields["infrastructure_ids"]:
            if not ObjectId.is_valid(i_id):
                raise ValueError(f"Invalid infrastructure_id: {i_id}")
            infra_exists = await client.infrastructures_col.find_one(
                {"_id": ObjectId(i_id)}
            )
            if not infra_exists:
                raise ValueError(f"Associated Infrastructure not found: {i_id}")
            infra_object_ids.append(ObjectId(i_id))
        update_fields["infrastructure_ids"] = infra_object_ids

    if not update_fields:
        return await get_solution(solution_id)

    update_fields["updated_at"] = datetime.utcnow()
    await client.solutions_col.update_one(
        {"_id": ObjectId(solution_id)}, {"$set": update_fields}
    )
    return await get_solution(solution_id)


async def delete_solution(solution_id: str) -> bool:
    if not ObjectId.is_valid(solution_id):
        return False
    result = await client.solutions_col.delete_one({"_id": ObjectId(solution_id)})
    if result.deleted_count > 0:
        await client.apps_col.update_many(
            {"solution_id": ObjectId(solution_id)},
            {"$set": {"solution_id": None}}
        )
        return True
    return False

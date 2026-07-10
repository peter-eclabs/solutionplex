from datetime import datetime
from typing import List, Optional

from bson import ObjectId

from server.database import client
from server.schemas.models import SolutionCreate, SolutionUpdate


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
        {"id": str(prob["_id"]), "title": prob["title"]} if prob else None
    )

    # Resolve architecture details
    arch_cursor = client.architectures_col.find(
        {"_id": {"$in": s.get("architecture_ids", [])}}
    )
    archs = await arch_cursor.to_list(length=100)
    s["architectures"] = [
        {"id": str(a["_id"]), "title": a["title"]} for a in archs
    ]

    # Resolve infrastructure details
    infra_cursor = client.infrastructures_col.find(
        {"_id": {"$in": s.get("infrastructure_ids", [])}}
    )
    infras = await infra_cursor.to_list(length=100)
    s["infrastructures"] = [
        {"id": str(i["_id"]), "title": i["title"]} for i in infras
    ]

    # Resolve apps referencing this solution
    app_cursor = client.apps_col.find({"solution_id": s["_id"]})
    apps = await app_cursor.to_list(length=100)
    s["apps"] = [
        {"id": str(a["_id"]), "title": a["title"]} for a in apps
    ]
    return s


async def get_solution(solution_id: str) -> Optional[dict]:
    if not ObjectId.is_valid(solution_id):
        return None
    s = await client.solutions_col.find_one({"_id": ObjectId(solution_id)})
    if not s:
        return None
    return await populate_solution(s)


async def list_solutions(q: Optional[str] = None) -> List[dict]:
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

    resolved_list = []
    for s in solutions:
        resolved_list.append(await populate_solution(s))
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

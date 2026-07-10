from datetime import datetime
from typing import List, Optional

from bson import ObjectId

from server.database import client
from server.schemas.models import ProblemCreate


async def create_problem(data: ProblemCreate) -> dict:
    doc = data.model_dump()
    doc["created_at"] = datetime.utcnow()
    doc["updated_at"] = doc["created_at"]
    result = await client.problems_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def get_problem(problem_id: str) -> Optional[dict]:
    if not ObjectId.is_valid(problem_id):
        return None
    doc = await client.problems_col.find_one({"_id": ObjectId(problem_id)})
    if not doc:
        return None

    # Resolve solutions associated with this problem
    solutions_cursor = client.solutions_col.find(
        {"problem_id": ObjectId(problem_id)}
    )
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
                {"description": {"$regex": q, "$options": "i"}},
            ]
        }
    cursor = client.problems_col.find(filter_query)
    problems = await cursor.to_list(length=100)

    for p in problems:
        solutions_cursor = client.solutions_col.find({"problem_id": p["_id"]})
        solutions = await solutions_cursor.to_list(length=100)
        p["solutions"] = [
            {"id": str(s["_id"]), "title": s["title"]} for s in solutions
        ]
    return problems

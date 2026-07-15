from datetime import datetime
from typing import List, Optional

from bson import ObjectId

from server.database import client
from server.database.client import next_code
from server.schemas.models import TechnologyCreate, TechnologyUpdate


async def create_technology(data: TechnologyCreate) -> dict:
    doc = data.model_dump()
    doc["code"] = await next_code("TECH")
    doc["created_at"] = datetime.utcnow()
    doc["updated_at"] = doc["created_at"]
    result = await client.technologies_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def get_technology(tech_id: str) -> Optional[dict]:
    if not ObjectId.is_valid(tech_id):
        return None
    return await client.technologies_col.find_one({"_id": ObjectId(tech_id)})


async def list_technologies(q: Optional[str] = None) -> List[dict]:
    filter_query = {}
    if q:
        filter_query = {
            "$or": [
                {"title": {"$regex": q, "$options": "i"}},
                {"description": {"$regex": q, "$options": "i"}},
            ]
        }
    cursor = client.technologies_col.find(filter_query)
    return await cursor.to_list(length=100)


async def update_technology(tech_id: str, data: TechnologyUpdate) -> Optional[dict]:
    if not ObjectId.is_valid(tech_id):
        return None
    existing = await client.technologies_col.find_one({"_id": ObjectId(tech_id)})
    if not existing:
        return None

    update_fields = {
        k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None
    }
    if not update_fields:
        existing["updated_at"] = existing.get("updated_at")
        return existing

    update_fields["updated_at"] = datetime.utcnow()
    await client.technologies_col.update_one(
        {"_id": ObjectId(tech_id)}, {"$set": update_fields}
    )
    updated = await client.technologies_col.find_one({"_id": ObjectId(tech_id)})
    return updated


async def delete_technology(tech_id: str) -> bool:
    if not ObjectId.is_valid(tech_id):
        return False
    result = await client.technologies_col.delete_one({"_id": ObjectId(tech_id)})
    if result.deleted_count == 0:
        return False
    await client.solutions_col.update_many(
        {"technology_ids": ObjectId(tech_id)},
        {"$pull": {"technology_ids": ObjectId(tech_id)}},
    )
    await client.apps_col.update_many(
        {"technology_ids": ObjectId(tech_id)},
        {"$pull": {"technology_ids": ObjectId(tech_id)}},
    )
    return True

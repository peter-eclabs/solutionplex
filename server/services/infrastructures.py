from datetime import datetime
from typing import List, Optional

from bson import ObjectId

from server.database import client
from server.schemas.models import InfrastructureCreate, InfrastructureUpdate


async def create_infrastructure(data: InfrastructureCreate) -> dict:
    doc = data.model_dump()
    doc["created_at"] = datetime.utcnow()
    doc["updated_at"] = doc["created_at"]
    result = await client.infrastructures_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def get_infrastructure(infra_id: str) -> Optional[dict]:
    if not ObjectId.is_valid(infra_id):
        return None
    return await client.infrastructures_col.find_one(
        {"_id": ObjectId(infra_id)}
    )


async def list_infrastructures(q: Optional[str] = None) -> List[dict]:
    filter_query = {}
    if q:
        filter_query = {
            "$or": [
                {"title": {"$regex": q, "$options": "i"}},
                {"description": {"$regex": q, "$options": "i"}},
            ]
        }
    cursor = client.infrastructures_col.find(filter_query)
    return await cursor.to_list(length=100)


async def update_infrastructure(infra_id: str, data: InfrastructureUpdate) -> Optional[dict]:
    if not ObjectId.is_valid(infra_id):
        return None
    existing = await client.infrastructures_col.find_one({"_id": ObjectId(infra_id)})
    if not existing:
        return None

    update_fields = {
        k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None
    }
    if not update_fields:
        return existing

    update_fields["updated_at"] = datetime.utcnow()
    await client.infrastructures_col.update_one(
        {"_id": ObjectId(infra_id)}, {"$set": update_fields}
    )
    updated = await client.infrastructures_col.find_one({"_id": ObjectId(infra_id)})
    return updated

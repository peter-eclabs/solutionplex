from datetime import datetime
from typing import List, Optional

from bson import ObjectId

from server.database import client
from server.database.client import next_code
from server.schemas.models import ArchitectureCreate, ArchitectureUpdate


async def create_architecture(data: ArchitectureCreate) -> dict:
    doc = data.model_dump()
    doc["code"] = await next_code("ARC")
    doc["created_at"] = datetime.utcnow()
    doc["updated_at"] = doc["created_at"]
    result = await client.architectures_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def get_architecture(arch_id: str) -> Optional[dict]:
    if not ObjectId.is_valid(arch_id):
        return None
    return await client.architectures_col.find_one({"_id": ObjectId(arch_id)})


async def list_architectures(q: Optional[str] = None) -> List[dict]:
    filter_query = {}
    if q:
        filter_query = {
            "$or": [
                {"title": {"$regex": q, "$options": "i"}},
                {"description": {"$regex": q, "$options": "i"}},
            ]
        }
    cursor = client.architectures_col.find(filter_query)
    return await cursor.to_list(length=100)


async def update_architecture(arch_id: str, data: ArchitectureUpdate) -> Optional[dict]:
    if not ObjectId.is_valid(arch_id):
        return None
    existing = await client.architectures_col.find_one({"_id": ObjectId(arch_id)})
    if not existing:
        return None

    update_fields = {
        k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None
    }
    if not update_fields:
        existing["updated_at"] = existing.get("updated_at")
        return existing

    update_fields["updated_at"] = datetime.utcnow()
    await client.architectures_col.update_one(
        {"_id": ObjectId(arch_id)}, {"$set": update_fields}
    )
    updated = await client.architectures_col.find_one({"_id": ObjectId(arch_id)})
    return updated


async def delete_architecture(arch_id: str) -> bool:
    if not ObjectId.is_valid(arch_id):
        return False
    result = await client.architectures_col.delete_one({"_id": ObjectId(arch_id)})
    if result.deleted_count == 0:
        return False
    # Detach this architecture from any solutions that reference it
    await client.solutions_col.update_many(
        {"architecture_ids": ObjectId(arch_id)},
        {"$pull": {"architecture_ids": ObjectId(arch_id)}},
    )
    return True

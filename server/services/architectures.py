from datetime import datetime
from typing import List, Optional

from bson import ObjectId

from server.database import client
from server.schemas.models import ArchitectureCreate


async def create_architecture(data: ArchitectureCreate) -> dict:
    doc = data.model_dump()
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

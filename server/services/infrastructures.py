from datetime import datetime
from typing import List, Optional

from bson import ObjectId

from server.database import client
from server.schemas.models import InfrastructureCreate


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

import logging

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument

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
counters_col = db["counters"]


async def next_code(prefix: str) -> str:
    """Atomically generate the next human-readable, prefixed, zero-padded code.

    Uses a `counters` collection with an atomic find_one_and_update `$inc`
    so concurrent inserts never produce duplicate codes per prefix.
    Example: next_code("PBM") -> "PBM-001"
    """
    result = await counters_col.find_one_and_update(
        {"_id": prefix},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"{prefix}-{result['seq']:03d}"

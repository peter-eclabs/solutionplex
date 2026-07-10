import logging

from motor.motor_asyncio import AsyncIOMotorClient

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

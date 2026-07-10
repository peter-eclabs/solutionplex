import base64
import logging
import re
from datetime import datetime
from typing import List, Optional

from bson import ObjectId
import httpx

from server.database import client
from server.schemas.models import AppCreate

logger = logging.getLogger(__name__)


async def create_app(data: AppCreate) -> dict:
    if not ObjectId.is_valid(data.problem_id):
        raise ValueError("Invalid problem_id")
    problem_exists = await client.problems_col.find_one(
        {"_id": ObjectId(data.problem_id)}
    )
    if not problem_exists:
        raise ValueError("Associated Problem not found")

    doc = {
        "title": data.title,
        "description": data.description,
        "github_url": data.github_url,
        "live_url": data.live_url,
        "problem_id": ObjectId(data.problem_id),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await client.apps_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def populate_app(a: dict) -> dict:
    prob = await client.problems_col.find_one({"_id": a["problem_id"]})
    a["problem"] = (
        {"id": str(prob["_id"]), "title": prob["title"]} if prob else None
    )
    return a


async def get_app(app_id: str) -> Optional[dict]:
    if not ObjectId.is_valid(app_id):
        return None
    a = await client.apps_col.find_one({"_id": ObjectId(app_id)})
    if not a:
        return None
    return await populate_app(a)


async def list_apps(q: Optional[str] = None) -> List[dict]:
    filter_query = {}
    if q:
        filter_query = {
            "$or": [
                {"title": {"$regex": q, "$options": "i"}},
                {"description": {"$regex": q, "$options": "i"}},
            ]
        }
    cursor = client.apps_col.find(filter_query)
    apps = await cursor.to_list(length=100)

    resolved_list = []
    for a in apps:
        resolved_list.append(await populate_app(a))
    return resolved_list


def parse_github_url(url: str) -> tuple[str, str]:
    pattern = r"https?://github\.com/([^/]+)/([^/]+)/?.*"
    match = re.match(pattern, url)
    if not match:
        raise ValueError("Invalid GitHub URL format")
    owner = match.group(1)
    repo = match.group(2)
    if repo.endswith(".git"):
        repo = repo[:-4]
    return owner, repo


async def fetch_readme(github_url: str) -> str:
    owner, repo = parse_github_url(github_url)
    api_url = f"https://api.github.com/repos/{owner}/{repo}/readme"

    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "Solutionplex-App",
    }
    async with httpx.AsyncClient() as client_http:
        try:
            response = await client_http.get(api_url, headers=headers)
        except Exception as e:
            logger.error(f"Failed to connect to GitHub API: {e}")
            raise ValueError(f"Failed to connect to GitHub API: {e}")

        if response.status_code != 200:
            logger.error(
                f"GitHub API returned {response.status_code} for {api_url}"
            )
            raise ValueError(
                f"Failed to fetch README from GitHub API (HTTP {response.status_code})"
            )

        data = response.json()
        content_b64 = data.get("content")
        if content_b64 is None:
            raise ValueError(
                "No content field found in GitHub README API response"
            )

        content_b64 = content_b64.replace("\n", "").replace("\r", "")
        try:
            decoded = base64.b64decode(content_b64).decode("utf-8")
        except Exception as e:
            logger.error(f"Failed to decode base64 README content: {e}")
            raise ValueError("Failed to decode README content from GitHub")

        return decoded

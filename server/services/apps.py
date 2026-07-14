import base64
import logging
import re
from datetime import datetime
from typing import List, Optional

from bson import ObjectId
import httpx

from server.database import client
from server.database.client import next_code
from server.schemas.models import AppCreate, AppUpdate, CurrentUser, Role
from server.services.visibility import hidden_problem_ids

logger = logging.getLogger(__name__)


async def _resolve_ref_ids(
    ids: List[str], collection, label: str
) -> List[ObjectId]:
    """Validate each id exists in collection and return ObjectId list.

    Args:
        ids: String ObjectId values to resolve.
        collection: MongoDB collection to look up against.
        label: Entity name used in error messages (e.g. "architecture").

    Returns:
        List of validated ObjectIds.

    Raises:
        ValueError: If an id is invalid or the referenced document is missing.
    """
    object_ids: List[ObjectId] = []
    for ref_id in ids:
        if not ObjectId.is_valid(ref_id):
            raise ValueError(f"Invalid {label}_id: {ref_id}")
        exists = await collection.find_one({"_id": ObjectId(ref_id)})
        if not exists:
            raise ValueError(
                f"Associated {label.capitalize()} not found: {ref_id}"
            )
        object_ids.append(ObjectId(ref_id))
    return object_ids


def _union_ref_ids(*id_lists: List) -> List[str]:
    """Ordered union of ObjectId / str id lists; first occurrence wins.

    Args:
        *id_lists: Sequences of ObjectId or string ids to merge left-to-right.

    Returns:
        Deduplicated list of string ids preserving first-seen order.
    """
    seen: set[str] = set()
    result: List[str] = []
    for id_list in id_lists:
        for ref_id in id_list or []:
            key = str(ref_id)
            if key not in seen:
                seen.add(key)
                result.append(key)
    return result


async def create_app(data: AppCreate) -> dict:
    sol_object_id = None
    sol_doc: Optional[dict] = None
    if data.solution_id:
        if not ObjectId.is_valid(data.solution_id):
            raise ValueError("Invalid solution_id")
        sol_doc = await client.solutions_col.find_one(
            {"_id": ObjectId(data.solution_id)}
        )
        if not sol_doc:
            raise ValueError("Associated Solution not found")
        sol_object_id = ObjectId(data.solution_id)

    # When linked to a solution with no explicit labels, snapshot the solution's
    # architecture/infrastructure onto the app so they remain after unlink.
    if (
        sol_doc is not None
        and not data.architecture_ids
        and not data.infrastructure_ids
    ):
        arch_object_ids = list(sol_doc.get("architecture_ids") or [])
        infra_object_ids = list(sol_doc.get("infrastructure_ids") or [])
    else:
        arch_object_ids = await _resolve_ref_ids(
            data.architecture_ids, client.architectures_col, "architecture"
        )
        infra_object_ids = await _resolve_ref_ids(
            data.infrastructure_ids, client.infrastructures_col, "infrastructure"
        )

    doc = {
        "title": data.title,
        "description": data.description,
        "github_url": data.github_url,
        "live_url": data.live_url,
        "solution_id": sol_object_id,
        "architecture_ids": arch_object_ids,
        "infrastructure_ids": infra_object_ids,
        "code": await next_code("APP"),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await client.apps_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def _resolve_label_docs(id_strs: List[str], collection) -> List[dict]:
    """Fetch arch/infra docs for id strings and return short refs in id order."""
    if not id_strs:
        return []
    object_ids = [ObjectId(x) for x in id_strs]
    cursor = collection.find({"_id": {"$in": object_ids}})
    docs = await cursor.to_list(length=100)
    by_id = {doc["_id"]: doc for doc in docs}
    return [
        {
            "id": str(oid),
            "code": by_id[oid].get("code"),
            "title": by_id[oid]["title"],
        }
        for oid in object_ids
        if oid in by_id
    ]


async def _populate_effective_labels(a: dict, sol: Optional[dict]) -> None:
    """Resolve architectures/infrastructures onto the app for API responses.

    App cards always show the app's own stored labels only. Linking does not
    change them. Solution row chips use solution effective_* fields instead
    (solution ∪ linked apps).
    """
    _ = sol  # Solution labels do not appear on the app card.
    arch_id_strs = _union_ref_ids(a.get("architecture_ids") or [])
    infra_id_strs = _union_ref_ids(a.get("infrastructure_ids") or [])

    a["architectures"] = await _resolve_label_docs(
        arch_id_strs, client.architectures_col
    )
    a["infrastructures"] = await _resolve_label_docs(
        infra_id_strs, client.infrastructures_col
    )


async def populate_app(a: dict) -> dict:
    sol: Optional[dict] = None
    sol_id = a.get("solution_id")
    problem_hidden = False
    if sol_id:
        sol = await client.solutions_col.find_one(
            {"_id": ObjectId(sol_id) if isinstance(sol_id, str) else sol_id}
        )
        if sol:
            a["solution"] = {
                "id": str(sol["_id"]),
                "code": sol.get("code"),
                "title": sol["title"],
            }
            prob = await client.problems_col.find_one({"_id": sol["problem_id"]})
            if prob:
                problem_hidden = bool(prob.get("hidden"))
                a["problem"] = {
                    "id": str(prob["_id"]),
                    "code": prob.get("code"),
                    "title": prob["title"],
                }
            else:
                a["problem"] = None
        else:
            a["solution"] = None
            a["problem"] = None
    else:
        a["solution"] = None
        a["problem"] = None

    if a["solution"]:
        a["solutions"] = [a["solution"]]
    else:
        a["solutions"] = []

    a["hidden"] = problem_hidden

    await _populate_effective_labels(a, sol)
    return a


async def get_app(app_id: str, current_user: Optional[CurrentUser] = None) -> Optional[dict]:
    if not ObjectId.is_valid(app_id):
        return None
    a = await client.apps_col.find_one({"_id": ObjectId(app_id)})
    if not a:
        return None
    if current_user is not None and current_user.role == Role.READER:
        sol_id = a.get("solution_id")
        if sol_id:
            sol = await client.solutions_col.find_one(
                {"_id": ObjectId(sol_id) if isinstance(sol_id, str) else sol_id}
            )
            if sol:
                prob = await client.problems_col.find_one({"_id": sol["problem_id"]})
                if prob and prob.get("hidden") is True:
                    from fastapi import HTTPException, status

                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="This app is hidden from readers",
                    )
    return await populate_app(a)


async def list_apps(q: Optional[str] = None, current_user: Optional[CurrentUser] = None) -> List[dict]:
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

    hidden_ids: set[str] = set()
    if current_user is not None and current_user.role == Role.READER:
        hidden_ids = await hidden_problem_ids()

    resolved_list = []
    for a in apps:
        pop = await populate_app(a)
        if hidden_ids and pop.get("problem") and pop["problem"]["id"] in hidden_ids:
            continue
        resolved_list.append(pop)
    return resolved_list


async def update_app(app_id: str, data: AppUpdate) -> Optional[dict]:
    if not ObjectId.is_valid(app_id):
        return None
    existing = await client.apps_col.find_one({"_id": ObjectId(app_id)})
    if not existing:
        return None

    update_fields = {
        k: v
        for k, v in data.model_dump(exclude_unset=True).items()
        if v is not None or k == "solution_id"
    }

    if "solution_id" in update_fields:
        s_id = update_fields["solution_id"]
        if s_id:
            if not ObjectId.is_valid(s_id):
                raise ValueError("Invalid solution_id")
            sol = await client.solutions_col.find_one(
                {"_id": ObjectId(s_id)}
            )
            if not sol:
                raise ValueError("Associated Solution not found")
            update_fields["solution_id"] = ObjectId(s_id)
            # Re-apply the union of the app's chosen labels with the linked
            # solution's labels on every update. This keeps inherited solution
            # labels present when the user adds/removes labels on the app card.
            if "architecture_ids" in update_fields:
                update_fields["architecture_ids"] = _union_ref_ids(
                    list(update_fields["architecture_ids"] or []),
                    list(sol.get("architecture_ids") or []),
                )
            if "infrastructure_ids" in update_fields:
                update_fields["infrastructure_ids"] = _union_ref_ids(
                    list(update_fields["infrastructure_ids"] or []),
                    list(sol.get("infrastructure_ids") or []),
                )
        else:
            # Unlinking: materialize concepts the card was inheriting so labels
            # still show on the app preview after the solution link is cleared.
            update_fields["solution_id"] = None
            prev_sol_id = existing.get("solution_id")
            if prev_sol_id:
                prev_sol = await client.solutions_col.find_one(
                    {
                        "_id": (
                            ObjectId(prev_sol_id)
                            if isinstance(prev_sol_id, str)
                            else prev_sol_id
                        )
                    }
                )
                if prev_sol:
                    if "architecture_ids" not in update_fields:
                        own_arch = existing.get("architecture_ids") or []
                        source_arch = own_arch or (
                            prev_sol.get("architecture_ids") or []
                        )
                        update_fields["architecture_ids"] = [
                            str(x) for x in source_arch
                        ]
                    if "infrastructure_ids" not in update_fields:
                        own_infra = existing.get("infrastructure_ids") or []
                        source_infra = own_infra or (
                            prev_sol.get("infrastructure_ids") or []
                        )
                        update_fields["infrastructure_ids"] = [
                            str(x) for x in source_infra
                        ]

    if "architecture_ids" in update_fields:
        raw_arch = update_fields["architecture_ids"] or []
        update_fields["architecture_ids"] = await _resolve_ref_ids(
            list(raw_arch),
            client.architectures_col,
            "architecture",
        )

    if "infrastructure_ids" in update_fields:
        raw_infra = update_fields["infrastructure_ids"] or []
        update_fields["infrastructure_ids"] = await _resolve_ref_ids(
            list(raw_infra),
            client.infrastructures_col,
            "infrastructure",
        )

    if not update_fields:
        return await get_app(app_id)

    update_fields["updated_at"] = datetime.utcnow()
    await client.apps_col.update_one(
        {"_id": ObjectId(app_id)}, {"$set": update_fields}
    )
    return await get_app(app_id)


async def delete_app(app_id: str) -> bool:
    if not ObjectId.is_valid(app_id):
        return False
    result = await client.apps_col.delete_one({"_id": ObjectId(app_id)})
    return result.deleted_count > 0


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

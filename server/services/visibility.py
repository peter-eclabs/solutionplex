from typing import Set

from server.database import client


async def hidden_problem_ids() -> Set[str]:
    """Return the set of string ids for problems flagged hidden from readers."""
    cursor = client.problems_col.find({"hidden": True}, {"_id": 1})
    docs = await cursor.to_list(length=100)
    return {str(d["_id"]) for d in docs}

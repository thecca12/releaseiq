"""
Global search endpoint — supports both GET and POST, uses DataSourceManager.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, Query
from pydantic import BaseModel

from app.utils.dependencies import CurrentUser

router = APIRouter(prefix="/search", tags=["Search"])


class SearchRequest(BaseModel):
    query: str
    filters: Optional[Dict[str, Any]] = None
    limit: int = 20


def _run_search(query: str, types_str: Optional[str], limit: int) -> Dict[str, Any]:
    """Core search logic — called by both GET and POST handlers."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()

    all_results = ds.search_all(query)

    # Apply type filter if specified
    if types_str:
        requested = {t.strip().lower() for t in types_str.split(",")}
        all_results = [r for r in all_results if r.get("type") in requested]

    normalized: List[Dict[str, Any]] = []
    for r in all_results[:limit]:
        result_type = r.get("type", "unknown")
        normalized.append({
            "type": result_type,
            "id": str(r.get("id", r.get("jira_id", r.get("version", "")))),
            "title": r.get("title", ""),
            "subtitle": r.get("snippet", "")[:120],
            "snippet": r.get("snippet", ""),
            "source": r.get("source", ""),
            "relevance_score": round(r.get("relevance", 0), 2),
            "url": _build_url(result_type, r),
            "icon": _icon_for_type(result_type),
            "metadata": {
                k: v for k, v in r.items()
                if k not in ("type", "relevance", "id", "title", "snippet", "source", "search_text")
                and isinstance(v, (str, int, float, bool))
            },
        })

    grouped: Dict[str, List] = {}
    for r in normalized:
        grouped.setdefault(r["type"], []).append(r)

    return {
        "query": query,
        "total": len(normalized),
        "results": normalized,
        "grouped": grouped,
    }


@router.get("", summary="Global search (GET)")
async def global_search_get(
    _: CurrentUser,
    q: str = Query(..., min_length=1, max_length=200),
    types: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=50),
) -> Dict[str, Any]:
    """Search across all DataSourceManager content."""
    return _run_search(q, types, limit)


@router.post("", summary="Global search (POST)")
async def global_search_post(
    _: CurrentUser,
    body: SearchRequest = Body(...),
) -> Dict[str, Any]:
    """Search via POST body — used by the frontend searchApi."""
    filters = body.filters or {}
    types_str = filters.get("types") if filters else None
    return _run_search(body.query, types_str, body.limit)


def _build_url(result_type: str, r: Dict[str, Any]) -> str:
    mapping = {
        "jira": f"/jira",
        "release": f"/releases",
        "patch_note": f"/patch-notes",
        "error_code": f"/error-codes",
        "circular": f"/circulars",
        "log": f"/logs",
        "flag": f"/flags",
    }
    return mapping.get(result_type, "#")


def _icon_for_type(result_type: str) -> str:
    return {
        "jira": "bug",
        "release": "package",
        "patch_note": "file-text",
        "error_code": "alert-circle",
        "circular": "globe",
        "log": "terminal",
        "flag": "flag",
    }.get(result_type, "search")

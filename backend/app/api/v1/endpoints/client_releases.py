"""
Client Release Tracking endpoints — served from DataSourceManager.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.utils.dependencies import CurrentUser

router = APIRouter(prefix="/client-releases", tags=["Client Releases"])


@router.get("", summary="List all client release deployments")
async def list_client_releases(
    _: CurrentUser,
    health: Optional[str] = Query(None, description="Filter by health: Healthy | Warning | Critical"),
    env: Optional[str] = Query(None, description="Filter by environment: LIVE | QA"),
    version: Optional[str] = Query(None, description="Filter by current version"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Dict[str, Any]:
    """Return all client deployment records with current version and health status."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    clients = ds.get_client_releases(health=health, env=env, version=version)

    total = len(clients)
    start = (page - 1) * page_size
    items = clients[start: start + page_size]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
    }


@router.get("/stats", summary="Client release health summary")
async def get_client_stats(_: CurrentUser) -> Dict[str, Any]:
    """Return health distribution and version distribution across all clients."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    all_clients = ds.get_client_releases()

    if not all_clients:
        return {"total": 0, "by_health": {}, "by_version": {}, "by_environment": {}}

    by_health: Dict[str, int] = {}
    by_version: Dict[str, int] = {}
    by_env: Dict[str, int] = {}

    for c in all_clients:
        h = c.get("health_status", "Unknown")
        by_health[h] = by_health.get(h, 0) + 1

        v = c.get("current_version", "Unknown")
        by_version[v] = by_version.get(v, 0) + 1

        e = c.get("environment", "Unknown")
        by_env[e] = by_env.get(e, 0) + 1

    latest_version = sorted(by_version.keys(), reverse=True)[0] if by_version else ""
    on_latest = by_version.get(latest_version, 0)

    return {
        "total": len(all_clients),
        "by_health": by_health,
        "by_version": by_version,
        "by_environment": by_env,
        "latest_version": latest_version,
        "clients_on_latest": on_latest,
        "clients_pending_upgrade": len(all_clients) - on_latest,
        "health_summary": {
            "healthy": by_health.get("Healthy", 0),
            "warning": by_health.get("Warning", 0),
            "critical": by_health.get("Critical", 0),
        },
    }


@router.get("/{client_id}", summary="Get specific client release details")
async def get_client_release(
    client_id: str,
    _: CurrentUser,
) -> Dict[str, Any]:
    """Return release details for a specific client."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    client = ds.get_client_by_id(client_id)

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Client '{client_id}' not found",
        )

    # Enrich with patch notes for their current version
    current_version = client.get("current_version", "")
    patch_note = ds.get_patch_note_by_version(current_version)

    return {
        **client,
        "patch_notes_available": patch_note is not None,
        "patch_notes_jira_refs": patch_note.get("jira_refs", []) if patch_note else [],
    }

"""
Patch Notes endpoints — served from DataSourceManager.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.utils.dependencies import CurrentUser

router = APIRouter(prefix="/patch-notes", tags=["Patch Notes"])


@router.get("", summary="List all patch notes")
async def list_patch_notes(
    _: CurrentUser,
    version: Optional[str] = Query(None, description="Filter by version, e.g. v9.48"),
    env: Optional[str] = Query(None, description="Filter by environment: qa | live"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Dict[str, Any]:
    """List all patch note files, optionally filtered by version or environment."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    notes = ds.get_patch_notes(version=version, env=env)

    total = len(notes)
    start = (page - 1) * page_size
    items = notes[start: start + page_size]

    summary_items = []
    for n in items:
        # Determine environment from environments list or environment field
        env_list = n.get("environments", [])
        env_str = n.get("environment", env_list[0] if env_list else "")
        summary_items.append({
            "version":        n.get("version", ""),
            "filename":       n.get("filename", ""),
            "release_date":   n.get("release_date", ""),
            "release_for":    n.get("release_for", n.get("version", "")),
            "environment":    env_str.upper() if env_str else "",
            "environments":   env_list,
            "component_type": n.get("component_type", "Both"),
            "jira_refs":      n.get("jira_refs", [])[:20],  # first 20 IDs
            "jira_count":     len(n.get("jira_refs", [])),
            "jira_items":     n.get("jira_items", [])[:50],  # first 50 full items
            "qa_notes":       n.get("qa_notes", "")[:2000],
            "live_notes":     n.get("live_notes", "")[:2000],
            "summary":        n.get("summary", ""),
            "format":         n.get("format", ""),
        })

    return {
        "items": summary_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
    }


@router.get("/search", summary="Search across all patch notes")
async def search_patch_notes(
    _: CurrentUser,
    q: str = Query(..., min_length=1, description="Search query"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Dict[str, Any]:
    """Full-text search across patch notes content."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    results = ds.search_all(q)
    patch_results = [r for r in results if r.get("type") == "patch_note"]
    total = len(patch_results)
    start = (page - 1) * page_size
    return {
        "query": q,
        "total": total,
        "page": page,
        "page_size": page_size,
        "results": patch_results[start: start + page_size],
    }


@router.get("/compare", summary="Compare two patch note versions")
async def compare_versions(
    _: CurrentUser,
    v1: str = Query(..., description="First version, e.g. v9.47"),
    v2: str = Query(..., description="Second version, e.g. v9.48"),
) -> Dict[str, Any]:
    """Compare JIRA refs and changes between two patch note versions."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()

    pn1 = ds.get_patch_note_by_version(v1)
    pn2 = ds.get_patch_note_by_version(v2)

    if not pn1:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Patch notes for {v1} not found")
    if not pn2:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Patch notes for {v2} not found")

    refs1 = set(pn1.get("jira_refs", []))
    refs2 = set(pn2.get("jira_refs", []))

    return {
        "v1": v1,
        "v2": v2,
        "v1_date": pn1.get("release_date"),
        "v2_date": pn2.get("release_date"),
        "jira_refs": {
            "in_both": sorted(refs1 & refs2),
            "only_in_v1": sorted(refs1 - refs2),
            "only_in_v2": sorted(refs2 - refs1),
        },
        "v1_jira_count": len(refs1),
        "v2_jira_count": len(refs2),
        "v1_live_notes_excerpt": pn1.get("live_notes", "")[:500],
        "v2_live_notes_excerpt": pn2.get("live_notes", "")[:500],
    }


@router.get("/{version}", summary="Get patch notes for a specific version")
async def get_patch_notes_by_version(
    version: str,
    _: CurrentUser,
) -> Dict[str, Any]:
    """Get full patch notes for a specific version (e.g., v9.48)."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()

    # Direct lookup
    pn = ds.get_patch_note_by_version(version)
    if not pn:
        # Try partial match
        matches = ds.get_patch_notes(version=version)
        if matches:
            pn = matches[0]

    if not pn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patch notes for version '{version}' not found",
        )

    return {
        "version": pn.get("version"),
        "filename": pn.get("filename"),
        "release_date": pn.get("release_date"),
        "environments": pn.get("environments", []),
        "jira_refs": pn.get("jira_refs", []),
        "qa_notes": pn.get("qa_notes", ""),
        "live_notes": pn.get("live_notes", ""),
    }

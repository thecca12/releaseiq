"""
Utilities endpoints — served from DataSourceManager.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from app.utils.dependencies import CurrentUser

router = APIRouter(prefix="/utilities", tags=["Utilities"])


@router.get("", summary="List all utility files")
async def list_utilities(_: CurrentUser) -> Dict[str, Any]:
    """Return a list of all files in the Datasource/Utilities folder."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    utilities = ds.get_utilities()
    return {"items": utilities, "total": len(utilities)}


@router.get("/{filename}", summary="Get utility file details")
async def get_utility(filename: str, _: CurrentUser) -> Dict[str, Any]:
    """Return metadata for a specific utility file."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    util = ds.get_utility_by_filename(filename)
    if not util:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Utility file '{filename}' not found",
        )
    return util


@router.get("/{filename}/download", summary="Download a utility file")
async def download_utility(filename: str, _: CurrentUser) -> FileResponse:
    """Download a specific utility file."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    util = ds.get_utility_by_filename(filename)
    if not util:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Utility file '{filename}' not found",
        )

    filepath = util.get("filepath", "")
    if not filepath:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File path not available",
        )

    from pathlib import Path
    path = Path(filepath)
    if not path.exists() or not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{filename}' does not exist on disk",
        )

    return FileResponse(
        path=str(path),
        filename=filename,
        media_type="application/octet-stream",
    )

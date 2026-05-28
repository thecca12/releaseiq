"""
Indexing management endpoints.

Provides status reporting, re-indexing triggers, and root folder configuration.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.logging import get_logger
from app.utils.dependencies import CurrentUser

router = APIRouter(prefix="/indexing", tags=["Indexing"])
logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class IndexingStatusResponse(BaseModel):
    status: str  # idle | running | failed
    last_indexed: Optional[str]
    total_files: int
    total_chunks: int
    chroma_document_count: int
    root_folder: str
    supported_extensions: list[str]


class ReindexRequest(BaseModel):
    folder_path: Optional[str] = None
    recursive: bool = True


class ReindexResponse(BaseModel):
    task_id: str
    status: str
    folder_path: str
    files_processed: int
    files_skipped: int
    chunks_indexed: int
    errors: list[str]
    duration_seconds: float
    started_at: datetime
    completed_at: datetime


class RootFolderRequest(BaseModel):
    folder_path: str


class RootFolderResponse(BaseModel):
    folder_path: str
    exists: bool
    file_count: int
    supported_file_count: int
    message: str


class IndexingStatsResponse(BaseModel):
    last_indexed: Optional[str]
    total_files_indexed: int
    total_chunks_indexed: int
    chroma_document_count: int
    avg_chunks_per_file: float
    supported_extensions: list[str]
    chroma_persist_dir: str
    root_data_folder: str


# ---------------------------------------------------------------------------
# State tracker (simple in-memory; replace with Redis/DB for prod)
# ---------------------------------------------------------------------------

_indexing_state = {
    "status": "idle",
    "last_task_id": None,
    "last_result": None,
}

SUPPORTED_EXTENSIONS = {".log", ".txt", ".json", ".csv", ".xlsx", ".pdf", ".docx"}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/status", response_model=IndexingStatusResponse, summary="Get indexing status")
async def get_indexing_status(current_user: CurrentUser) -> IndexingStatusResponse:
    """Return current indexing status, including DataSourceManager stats."""
    from app.services.indexing_service import indexing_service
    from app.services.datasource.manager import get_datasource_manager

    stats = indexing_service.get_indexing_stats()
    ds = get_datasource_manager()
    ds_stats = ds.get_stats()
    total_ds_files = sum(ds_stats.values())

    return IndexingStatusResponse(
        status=_indexing_state["status"],
        last_indexed=ds.last_refresh or stats.get("last_indexed"),
        total_files=total_ds_files or stats.get("total_files", 0),
        total_chunks=stats.get("total_chunks", 0),
        chroma_document_count=stats.get("chroma_document_count", 0),
        root_folder=settings.ROOT_DATA_FOLDER,
        supported_extensions=list(SUPPORTED_EXTENSIONS),
    )


@router.post(
    "/reindex",
    response_model=ReindexResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger re-indexing",
)
async def trigger_reindex(
    body: ReindexRequest,
    current_user: CurrentUser,
) -> ReindexResponse:
    """
    Re-index the specified folder (or ROOT_DATA_FOLDER if not provided).

    This is a synchronous operation; for large folders consider a background task.
    """
    import uuid
    import time

    from app.services.indexing_service import indexing_service

    if _indexing_state["status"] == "running":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An indexing job is already in progress. Please wait for it to complete.",
        )

    folder = body.folder_path or settings.ROOT_DATA_FOLDER
    task_id = str(uuid.uuid4())

    logger.info("reindex_triggered", folder=folder, task_id=task_id, user=current_user.id)

    _indexing_state["status"] = "running"
    _indexing_state["last_task_id"] = task_id

    started_at = datetime.utcnow()
    try:
        result = indexing_service.index_folder(folder)
        _indexing_state["status"] = "idle"
        _indexing_state["last_result"] = result
    except Exception as exc:
        _indexing_state["status"] = "failed"
        logger.error("reindex_failed", folder=folder, error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Indexing failed: {exc}",
        )

    # Also refresh DataSourceManager cache
    try:
        from app.services.datasource.manager import get_datasource_manager
        get_datasource_manager().refresh()
        logger.info("datasource_refreshed_after_reindex")
    except Exception as exc:
        logger.warning(f"DataSourceManager refresh failed after reindex: {exc}")

    completed_at = datetime.utcnow()

    return ReindexResponse(
        task_id=task_id,
        status="completed",
        folder_path=folder,
        files_processed=result.files_processed,
        files_skipped=result.files_skipped,
        chunks_indexed=result.chunks_indexed,
        errors=result.errors,
        duration_seconds=result.duration_seconds,
        started_at=started_at,
        completed_at=completed_at,
    )


@router.post(
    "/root-folder",
    response_model=RootFolderResponse,
    summary="Set and validate root data folder",
)
async def set_root_folder(
    body: RootFolderRequest,
    current_user: CurrentUser,
) -> RootFolderResponse:
    """
    Validate and report on a proposed root data folder.

    Note: This does not persist the change to settings at runtime.
    Update ROOT_DATA_FOLDER in your .env file for a permanent change.
    """
    folder = Path(body.folder_path)
    exists = folder.exists() and folder.is_dir()

    file_count = 0
    supported_count = 0

    if exists:
        try:
            for f in folder.rglob("*"):
                if f.is_file():
                    file_count += 1
                    if f.suffix.lower() in SUPPORTED_EXTENSIONS:
                        supported_count += 1
        except PermissionError:
            pass

    message = (
        f"Folder exists. Found {file_count} files, {supported_count} indexable."
        if exists
        else f"Folder not found: {body.folder_path}"
    )

    logger.info(
        "root_folder_validated",
        path=body.folder_path,
        exists=exists,
        files=file_count,
        indexable=supported_count,
    )

    return RootFolderResponse(
        folder_path=body.folder_path,
        exists=exists,
        file_count=file_count,
        supported_file_count=supported_count,
        message=message,
    )


@router.get("/stats", response_model=IndexingStatsResponse, summary="Get detailed indexing statistics")
async def get_indexing_stats(current_user: CurrentUser) -> IndexingStatsResponse:
    """Return detailed statistics about indexed content and datasource files."""
    from app.services.indexing_service import indexing_service
    from app.services.datasource.manager import get_datasource_manager

    stats = indexing_service.get_indexing_stats()
    ds = get_datasource_manager()
    ds_stats = ds.get_stats()
    file_counts = ds.count_datasource_files()
    total_ds_files = sum(ds_stats.values())

    total_files = stats.get("total_files", 0) or total_ds_files
    total_chunks = stats.get("total_chunks", 0)
    avg_chunks = round(total_chunks / total_files, 2) if total_files > 0 else 0.0

    return IndexingStatsResponse(
        last_indexed=ds.last_refresh or stats.get("last_indexed"),
        total_files_indexed=total_files,
        total_chunks_indexed=total_chunks,
        chroma_document_count=stats.get("chroma_document_count", 0),
        avg_chunks_per_file=avg_chunks,
        supported_extensions=list(SUPPORTED_EXTENSIONS),
        chroma_persist_dir=settings.CHROMA_PERSIST_DIR,
        root_data_folder=settings.ROOT_DATA_FOLDER,
    )


@router.get("/datasource/stats", summary="DataSourceManager item counts per source")
async def get_datasource_stats(current_user: CurrentUser) -> dict:
    """Return item counts per datasource parser and file counts per folder."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    return {
        "item_counts": ds.get_stats(),
        "file_counts_by_folder": ds.count_datasource_files(),
        "last_refresh": ds.last_refresh,
        "datasource_root": str(ds.root),
    }


@router.post("/datasource/refresh", summary="Refresh DataSourceManager cache")
async def refresh_datasource(current_user: CurrentUser) -> dict:
    """Force reload all datasource data from disk."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    ds.refresh()
    return {
        "status": "refreshed",
        "last_refresh": ds.last_refresh,
        "item_counts": ds.get_stats(),
    }

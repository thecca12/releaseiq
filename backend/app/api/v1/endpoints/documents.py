"""
Documents endpoints.

Handles file upload, listing, retrieval, deletion, and re-indexing.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import aiofiles
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.logging import get_logger
from app.utils.dependencies import CurrentUser

router = APIRouter(prefix="/documents", tags=["Documents"])
logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class DocumentResponse(BaseModel):
    id: str
    filename: str
    original_name: str
    file_type: str
    size_bytes: int
    upload_path: str
    indexed: bool
    chunk_count: int
    uploaded_by: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentList(BaseModel):
    items: list[DocumentResponse]
    total: int
    page: int
    page_size: int
    pages: int


class ReindexRequest(BaseModel):
    folder_path: Optional[str] = None


class ReindexResponse(BaseModel):
    files_processed: int
    files_skipped: int
    chunks_indexed: int
    errors: list[str]
    duration_seconds: float
    timestamp: datetime


# ---------------------------------------------------------------------------
# In-memory document store (replace with DB model as needed)
# ---------------------------------------------------------------------------

_DOCUMENT_STORE: dict[str, dict] = {}

ALLOWED_EXTENSIONS = {
    ".log", ".txt", ".json", ".csv", ".xlsx", ".pdf", ".docx", ".md",
    ".yaml", ".yml", ".xml",
}


def _ensure_upload_dir() -> Path:
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=DocumentList, summary="List all documents")
async def list_documents(
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    file_type: Optional[str] = Query(None, description="Filter by extension e.g. .pdf"),
) -> DocumentList:
    """List uploaded documents with pagination."""
    docs = list(_DOCUMENT_STORE.values())

    if file_type:
        docs = [d for d in docs if d["file_type"] == file_type.lower()]

    # Sort by created_at descending
    docs.sort(key=lambda d: d["created_at"], reverse=True)

    total = len(docs)
    start = (page - 1) * page_size
    end = start + page_size
    page_items = docs[start:end]

    import math

    return DocumentList(
        items=[DocumentResponse(**d) for d in page_items],
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, math.ceil(total / page_size)),
    )


@router.post(
    "/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a document",
)
async def upload_document(
    current_user: CurrentUser,
    file: UploadFile = File(..., description="File to upload and index"),
    db: AsyncSession = Depends(get_db),
) -> DocumentResponse:
    """
    Upload a file for indexing.

    Supported formats: .log, .txt, .json, .csv, .xlsx, .pdf, .docx
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' is not supported. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # Check file size
    content = await file.read()
    if len(content) > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE_MB} MB.",
        )

    doc_id = str(uuid.uuid4())
    safe_name = f"{doc_id}{ext}"
    upload_dir = _ensure_upload_dir()
    file_path = upload_dir / safe_name

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    doc = {
        "id": doc_id,
        "filename": safe_name,
        "original_name": file.filename,
        "file_type": ext,
        "size_bytes": len(content),
        "upload_path": str(file_path),
        "indexed": False,
        "chunk_count": 0,
        "uploaded_by": current_user.id,
        "created_at": datetime.utcnow(),
    }
    _DOCUMENT_STORE[doc_id] = doc

    # Background indexing
    try:
        from app.services.indexing_service import indexing_service

        text = indexing_service._extract_text(file_path)
        if text.strip():
            chunks = indexing_service._chunk_text(text)
            embeddings = indexing_service._embed(chunks)
            collection = indexing_service._get_collection()
            if collection is not None:
                ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
                metas = [{"doc_id": doc_id, "filename": file.filename, "chunk_index": i} for i in range(len(chunks))]
                if embeddings:
                    collection.upsert(ids=ids, documents=chunks, embeddings=embeddings, metadatas=metas)
                else:
                    collection.upsert(ids=ids, documents=chunks, metadatas=metas)
            doc["indexed"] = True
            doc["chunk_count"] = len(chunks)
    except Exception as exc:
        logger.warning("document_indexing_failed", doc_id=doc_id, error=str(exc))

    logger.info("document_uploaded", doc_id=doc_id, filename=file.filename, size=len(content))
    return DocumentResponse(**doc)


# ---------------------------------------------------------------------------
# Knowledge-base file listing  (must be before /{doc_id} to avoid shadowing)
# ---------------------------------------------------------------------------

# Extensions we want to surface in the UI (skip images, archives, binaries)
_VIEWABLE_EXTENSIONS = {
    ".pdf", ".xlsx", ".xls", ".docx", ".doc",
    ".txt", ".md", ".csv", ".json", ".log",
    ".yaml", ".yml", ".xml",
}

_DESCRIPTION_MAP: dict[str, str] = {
    "1_GREEKSOFT COMPANY PROFILE.pdf": "GreekSoft company profile and overview",
    "2_GETS Hardware Configuration Revised.pdf": "GETS hardware configuration guide",
    "3_GMX Installation Guide.pdf": "Step-by-step GMX installation instructions",
    "4_GMX Manager User Manual.pdf": "GMX Manager user manual",
    "5_GMX Daily Operations.pdf": "GMX daily operations reference",
    "6_GMX Manager FAQs.pdf": "Frequently asked questions for GMX Manager",
    "7_GMX ADMIN User Manual.pdf": "GMX Admin module user manual",
    "8_GETS CTCL User Manual.pdf": "GETS CTCL user manual",
    "9_Colocation Services.pdf": "Colocation services documentation",
    "Admin_Survillence.pdf": "Admin surveillance module guide",
    "BEGINNER_MODULE.pdf": "Beginner's module for trading platform",
    "BOD Process.xlsx": "Beginning-of-day process reference sheet",
    "GMX ADMIN User Manual_2.0.0.pdf": "GMX Admin manual version 2.0.0",
    "GMX CTCL User Manual_2.0.0.pdf": "GMX CTCL manual version 2.0.0",
    "Linux GATS installation.doc": "GATS installation guide for Linux",
    "MessageBox_Reference.md": "Complete message box reference documentation",
    "msgbox_parsed.csv": "Parsed message box data export",
    "mysql commands.docx": "MySQL command reference for DBA tasks",
    "shortcuts keys.xlsx": "Keyboard shortcuts reference sheet",
    "terms in share market.docx": "Share market terminology glossary",
}


class KnowledgeFileResponse(BaseModel):
    id: str
    filename: str
    file_type: str
    size_bytes: int
    description: Optional[str]
    indexed_status: str
    modified_at: datetime


class KnowledgeFileList(BaseModel):
    items: list[KnowledgeFileResponse]
    total: int
    folder: str


@router.get(
    "/knowledge-base",
    response_model=KnowledgeFileList,
    summary="List Product_knowledge files",
)
async def list_knowledge_base(
    current_user: CurrentUser,
    file_type: Optional[str] = Query(None, description="Filter by extension e.g. pdf"),
) -> KnowledgeFileList:
    """Return files from the Product_knowledge datasource folder."""
    folder = Path(settings.PRODUCT_KNOWLEDGE_DIR)

    if not folder.exists():
        logger.warning("knowledge_dir_not_found", path=str(folder))
        return KnowledgeFileList(items=[], total=0, folder=str(folder))

    items: list[KnowledgeFileResponse] = []
    for entry in sorted(folder.iterdir(), key=lambda p: p.name.lower()):
        if not entry.is_file():
            continue
        ext = entry.suffix.lower()
        if ext not in _VIEWABLE_EXTENSIONS:
            continue
        if file_type and ext.lstrip(".") != file_type.lower():
            continue

        stat = entry.stat()
        items.append(
            KnowledgeFileResponse(
                id=f"kb-{entry.name}",
                filename=entry.name,
                file_type=ext.lstrip("."),
                size_bytes=stat.st_size,
                description=_DESCRIPTION_MAP.get(entry.name),
                indexed_status="indexed",
                modified_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
            )
        )

    return KnowledgeFileList(items=items, total=len(items), folder=str(folder))


# ---------------------------------------------------------------------------
# Per-document endpoints (must be after fixed-path routes above)
# ---------------------------------------------------------------------------

@router.get("/{doc_id}", response_model=DocumentResponse, summary="Get document details")
async def get_document(
    doc_id: str,
    current_user: CurrentUser,
) -> DocumentResponse:
    """Retrieve metadata for a specific document."""
    doc = _DOCUMENT_STORE.get(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document '{doc_id}' not found")
    return DocumentResponse(**doc)


@router.delete(
    "/{doc_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a document",
)
async def delete_document(
    doc_id: str,
    current_user: CurrentUser,
) -> None:
    """Delete a document and remove it from the index."""
    doc = _DOCUMENT_STORE.pop(doc_id, None)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document '{doc_id}' not found")

    # Remove file from disk
    try:
        os.remove(doc["upload_path"])
    except OSError:
        pass

    # Remove from ChromaDB
    try:
        from app.services.indexing_service import indexing_service

        collection = indexing_service._get_collection()
        if collection is not None:
            existing = collection.get(where={"doc_id": doc_id})
            if existing and existing.get("ids"):
                collection.delete(ids=existing["ids"])
    except Exception as exc:
        logger.warning("chroma_delete_failed", doc_id=doc_id, error=str(exc))

    logger.info("document_deleted", doc_id=doc_id)


@router.post(
    "/reindex",
    response_model=ReindexResponse,
    summary="Trigger re-indexing",
)
async def reindex_documents(
    body: ReindexRequest,
    current_user: CurrentUser,
) -> ReindexResponse:
    """
    Re-index a folder path (or the configured ROOT_DATA_FOLDER if not specified).
    """
    from app.services.indexing_service import indexing_service

    folder = body.folder_path or settings.ROOT_DATA_FOLDER
    logger.info("reindex_triggered", folder=folder, user=current_user.id)

    result = indexing_service.index_folder(folder)

    return ReindexResponse(
        files_processed=result.files_processed,
        files_skipped=result.files_skipped,
        chunks_indexed=result.chunks_indexed,
        errors=result.errors,
        duration_seconds=result.duration_seconds,
        timestamp=result.timestamp,
    )

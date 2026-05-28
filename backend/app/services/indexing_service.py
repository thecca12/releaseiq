"""
File Indexing Service.

Walks a directory tree, extracts text from supported file types, generates
sentence-transformer embeddings, and stores them in ChromaDB for RAG queries.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

SUPPORTED_EXTENSIONS = {".log", ".txt", ".json", ".csv", ".xlsx", ".pdf", ".docx"}

_SOH = re.compile(r"\x01|\||\^A")


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass
class LogEntry:
    """A single parsed log line."""

    line_number: int
    raw: str
    level: str = ""
    timestamp: Optional[datetime] = None
    message: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class FIXMessage:
    """A lightweight FIX message container for indexing purposes."""

    msg_type: str
    cl_ord_id: str
    orig_cl_ord_id: str
    tags: dict[str, str]
    raw: str


@dataclass
class IndexingResult:
    """Summary of an indexing run."""

    folder_path: str
    files_processed: int = 0
    files_skipped: int = 0
    chunks_indexed: int = 0
    errors: list[str] = field(default_factory=list)
    duration_seconds: float = 0.0
    timestamp: datetime = field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# IndexingService
# ---------------------------------------------------------------------------


class IndexingService:
    """
    Indexes a local folder hierarchy into ChromaDB for semantic search.

    Gracefully degrades when optional dependencies (ChromaDB,
    sentence-transformers) are not installed.
    """

    def __init__(self) -> None:
        self._collection: Any = None
        self._embedding_model: Any = None
        self._stats: dict[str, Any] = {
            "last_indexed": None,
            "total_chunks": 0,
            "total_files": 0,
        }

    # ------------------------------------------------------------------
    # ChromaDB / embedding helpers
    # ------------------------------------------------------------------

    def _get_collection(self) -> Any:
        """Return (or initialise) the ChromaDB collection."""
        if self._collection is not None:
            return self._collection
        try:
            import chromadb

            client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
            self._collection = client.get_or_create_collection(
                "releaseiq_docs",
                metadata={"hnsw:space": "cosine"},
            )
            logger.info("chromadb_collection_ready", path=settings.CHROMA_PERSIST_DIR)
        except Exception as exc:
            logger.warning("chromadb_unavailable", error=str(exc))
            self._collection = None
        return self._collection

    def _get_embedding_model(self) -> Any:
        """Return (or initialise) the sentence-transformer model."""
        if self._embedding_model is not None:
            return self._embedding_model
        try:
            from sentence_transformers import SentenceTransformer

            self._embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("embedding_model_loaded")
        except Exception as exc:
            logger.warning("embedding_model_unavailable", error=str(exc))
        return self._embedding_model

    def _embed(self, texts: list[str]) -> Optional[list[list[float]]]:
        """Generate embeddings. Returns None if model unavailable."""
        model = self._get_embedding_model()
        if model is None:
            return None
        try:
            return model.encode(texts, show_progress_bar=False).tolist()
        except Exception as exc:
            logger.warning("embedding_failed", error=str(exc))
            return None

    def _chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
        """Split text into overlapping chunks of approximately `chunk_size` chars."""
        words = text.split()
        chunks: list[str] = []
        i = 0
        while i < len(words):
            chunk = " ".join(words[i : i + chunk_size])
            chunks.append(chunk)
            i += chunk_size - overlap
        return chunks or [text]

    def _doc_id(self, path: str, chunk_index: int) -> str:
        """Generate a stable document ID."""
        digest = hashlib.md5(f"{path}:{chunk_index}".encode()).hexdigest()[:12]
        return f"{digest}_{chunk_index}"

    # ------------------------------------------------------------------
    # Text extraction
    # ------------------------------------------------------------------

    def _extract_text(self, path: Path) -> str:
        """Dispatch to the appropriate extractor based on file extension."""
        ext = path.suffix.lower()
        try:
            if ext in (".txt", ".log"):
                return path.read_text(errors="replace")
            elif ext == ".json":
                data = json.loads(path.read_text(errors="replace"))
                return json.dumps(data, indent=2)
            elif ext == ".csv":
                return path.read_text(errors="replace")
            elif ext == ".xlsx":
                return self._extract_xlsx(path)
            elif ext == ".pdf":
                return self._extract_pdf(path)
            elif ext == ".docx":
                return self._extract_docx(path)
        except Exception as exc:
            logger.warning("text_extraction_failed", path=str(path), error=str(exc))
        return ""

    def _extract_xlsx(self, path: Path) -> str:
        import pandas as pd

        dfs = pd.read_excel(str(path), sheet_name=None)
        parts = []
        for sheet_name, df in dfs.items():
            parts.append(f"=== Sheet: {sheet_name} ===")
            parts.append(df.to_csv(index=False))
        return "\n".join(parts)

    def _extract_pdf(self, path: Path) -> str:
        try:
            import PyPDF2

            with open(path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                pages = [page.extract_text() or "" for page in reader.pages]
            return "\n".join(pages)
        except Exception:
            pass
        return ""

    def _extract_docx(self, path: Path) -> str:
        from docx import Document

        doc = Document(str(path))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())

    # ------------------------------------------------------------------
    # Metadata extraction
    # ------------------------------------------------------------------

    def extract_metadata(self, path: str) -> dict[str, Any]:
        """Extract file metadata (size, modified time, extension, etc.)."""
        p = Path(path)
        try:
            stat = p.stat()
            return {
                "file_path": str(p),
                "file_name": p.name,
                "extension": p.suffix.lower(),
                "size_bytes": stat.st_size,
                "modified_at": datetime.utcfromtimestamp(stat.st_mtime).isoformat(),
                "created_at": datetime.utcfromtimestamp(stat.st_ctime).isoformat(),
            }
        except Exception as exc:
            return {"file_path": path, "error": str(exc)}

    # ------------------------------------------------------------------
    # FIX log parsing
    # ------------------------------------------------------------------

    def parse_log_file(self, path: str) -> list[LogEntry]:
        """Parse a generic log file into structured LogEntry objects."""
        entries: list[LogEntry] = []
        level_pattern = re.compile(
            r"\b(DEBUG|INFO|WARNING|ERROR|CRITICAL|TRACE|WARN)\b", re.IGNORECASE
        )
        ts_pattern = re.compile(
            r"(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?)"
        )

        with open(path, errors="replace") as fh:
            for i, line in enumerate(fh, start=1):
                line = line.rstrip()
                entry = LogEntry(line_number=i, raw=line)

                ts_match = ts_pattern.search(line)
                if ts_match:
                    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S",
                                "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
                        try:
                            entry.timestamp = datetime.strptime(ts_match.group(1)[:26], fmt)
                            break
                        except ValueError:
                            continue

                level_match = level_pattern.search(line)
                if level_match:
                    entry.level = level_match.group(1).upper()

                # Strip leading metadata for the message
                msg_part = level_pattern.sub("", ts_pattern.sub("", line)).strip(" :-|[]")
                entry.message = msg_part[:500]

                entries.append(entry)

        return entries

    def parse_fix_log(self, content: str) -> list[FIXMessage]:
        """
        Parse FIX protocol messages from a multi-line log string.

        Supports SOH (\\x01), pipe (|), and caret-A (^A) delimiters.
        Extracts NewOrderSingle (35=D), OrderCancelReplaceRequest (35=G),
        OrderCancelRequest (35=F), and ExecutionReport (35=8).
        """
        messages: list[FIXMessage] = []
        target_types = {"D", "G", "F", "8"}

        for line in content.splitlines():
            if "8=FIX" not in line:
                continue
            # Find start of FIX message
            start = line.find("8=FIX")
            raw = line[start:]

            tags: dict[str, str] = {}
            for part in _SOH.split(raw):
                if "=" in part:
                    tag, _, val = part.partition("=")
                    tags[tag.strip()] = val.strip()

            msg_type = tags.get("35", "")
            if msg_type not in target_types:
                continue

            messages.append(
                FIXMessage(
                    msg_type=msg_type,
                    cl_ord_id=tags.get("11", ""),
                    orig_cl_ord_id=tags.get("41", ""),
                    tags=tags,
                    raw=raw,
                )
            )

        return messages

    # ------------------------------------------------------------------
    # Indexing
    # ------------------------------------------------------------------

    def index_folder(self, folder_path: str) -> IndexingResult:
        """
        Walk the directory tree rooted at `folder_path`, extract text from
        supported files, generate embeddings, and upsert into ChromaDB.
        """
        import time

        start = time.time()
        result = IndexingResult(folder_path=folder_path)
        collection = self._get_collection()

        root = Path(folder_path)
        if not root.exists():
            result.errors.append(f"Folder not found: {folder_path}")
            return result

        for file_path in root.rglob("*"):
            if not file_path.is_file():
                continue
            if file_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
                result.files_skipped += 1
                continue

            # Skip very large files (>100 MB)
            try:
                if file_path.stat().st_size > 100 * 1024 * 1024:
                    result.files_skipped += 1
                    logger.info("file_too_large_skipped", path=str(file_path))
                    continue
            except OSError:
                result.files_skipped += 1
                continue

            text = self._extract_text(file_path)
            if not text.strip():
                result.files_skipped += 1
                continue

            metadata = self.extract_metadata(str(file_path))
            chunks = self._chunk_text(text)
            embeddings = self._embed(chunks)

            if collection is not None:
                ids = [self._doc_id(str(file_path), i) for i in range(len(chunks))]
                metas = [{**metadata, "chunk_index": i} for i in range(len(chunks))]

                if embeddings:
                    collection.upsert(
                        ids=ids,
                        documents=chunks,
                        embeddings=embeddings,
                        metadatas=metas,
                    )
                else:
                    collection.upsert(
                        ids=ids,
                        documents=chunks,
                        metadatas=metas,
                    )

            result.files_processed += 1
            result.chunks_indexed += len(chunks)
            logger.info(
                "file_indexed",
                path=str(file_path),
                chunks=len(chunks),
            )

        result.duration_seconds = round(time.time() - start, 2)

        # Update stats
        self._stats["last_indexed"] = datetime.utcnow().isoformat()
        self._stats["total_files"] = result.files_processed
        self._stats["total_chunks"] = result.chunks_indexed

        logger.info(
            "indexing_complete",
            files=result.files_processed,
            chunks=result.chunks_indexed,
            duration=result.duration_seconds,
        )
        return result

    def get_indexing_stats(self) -> dict[str, Any]:
        """Return current indexing statistics."""
        collection = self._get_collection()
        chroma_count = 0
        if collection is not None:
            try:
                chroma_count = collection.count()
            except Exception:
                pass

        return {
            **self._stats,
            "chroma_document_count": chroma_count,
            "supported_extensions": list(SUPPORTED_EXTENSIONS),
            "chroma_persist_dir": settings.CHROMA_PERSIST_DIR,
        }


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

indexing_service = IndexingService()

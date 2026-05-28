"""
Full project backup endpoint — admin only.
Streams a JSON archive of all database tables as a downloadable file.
"""

import io
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.models.issue import JiraIssue
from app.models.release import ClientRelease, DeploymentHistory, Release
from app.models.user import AuditLog, User
from app.utils.dependencies import AdminUser

router = APIRouter(prefix="/backup", tags=["Backup"])
logger = get_logger(__name__)


def _serialize(obj: object) -> object:
    """Recursively make an ORM row JSON-serialisable."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    if hasattr(obj, "__dict__"):
        return {
            k: _serialize(v)
            for k, v in obj.__dict__.items()
            if not k.startswith("_")
        }
    return obj


async def _fetch_all(db: AsyncSession, model) -> list:
    result = await db.execute(select(model))
    return [_serialize(row) for row in result.scalars().all()]


@router.get(
    "/download",
    summary="Download full project backup (admin)",
    response_class=StreamingResponse,
)
async def download_backup(
    _: AdminUser,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    now = datetime.now(timezone.utc)

    logger.info("backup_started", initiated_at=now.isoformat())

    payload: dict = {
        "backup_meta": {
            "created_at": now.isoformat(),
            "version": "1.0",
            "application": "ReleaseIQ",
            "organization": "GreekSoft Technologies",
        },
        "users": await _fetch_all(db, User),
        "releases": await _fetch_all(db, Release),
        "client_releases": await _fetch_all(db, ClientRelease),
        "deployment_history": await _fetch_all(db, DeploymentHistory),
        "jira_issues": await _fetch_all(db, JiraIssue),
        "audit_logs": await _fetch_all(db, AuditLog),
    }

    # Add row counts to meta
    payload["backup_meta"]["record_counts"] = {
        table: len(rows) for table, rows in payload.items() if table != "backup_meta"
    }

    json_bytes = json.dumps(payload, indent=2, default=str).encode("utf-8")
    filename = f"releaseiq_backup_{now.strftime('%Y%m%d_%H%M%S')}.json"

    logger.info("backup_completed", filename=filename, size_bytes=len(json_bytes))

    return StreamingResponse(
        io.BytesIO(json_bytes),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(json_bytes)),
        },
    )


@router.get("/stats", summary="Get backup statistics (admin)")
async def backup_stats(
    _: AdminUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Returns row counts for each table — lightweight pre-flight check."""
    tables = {
        "users": User,
        "releases": Release,
        "client_releases": ClientRelease,
        "deployment_history": DeploymentHistory,
        "jira_issues": JiraIssue,
        "audit_logs": AuditLog,
    }
    counts: dict[str, int] = {}
    for name, model in tables.items():
        result = await db.execute(select(model))
        counts[name] = len(result.scalars().all())

    return {
        "record_counts": counts,
        "total_records": sum(counts.values()),
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }

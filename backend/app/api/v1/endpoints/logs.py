"""
Logs endpoints — system log files from DataSourceManager + audit logs from DB.
"""

import math
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import AuditLog
from app.schemas.user import AuditLogListResponse, AuditLogResponse
from app.utils.dependencies import AdminUser, CurrentUser

router = APIRouter(prefix="/logs", tags=["Logs"])


# ---------------------------------------------------------------------------
# Datasource log file helpers
# ---------------------------------------------------------------------------


def _logfile_to_summary(lf: Dict[str, Any], idx: int) -> Dict[str, Any]:
    """Convert a log file dict from DataSourceManager to frontend-expected format."""
    from pathlib import Path
    path = lf.get("filepath", "")
    try:
        import os
        mtime = os.path.getmtime(path) if path else None
        indexed_at = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat() if mtime else None
    except Exception:
        indexed_at = None

    return {
        "id": f"ds-log-{idx:03d}",
        "filename": lf.get("filename", ""),
        "module": lf.get("module", ""),
        "size_bytes": lf.get("size_bytes", 0),
        "indexed_at": indexed_at,
        "log_type": "application",
        "entry_count": lf.get("entry_count", 0),
        "total_lines": lf.get("total_lines", 0),
        "error_count": lf.get("error_count", 0),
        "warn_count": lf.get("warn_count", 0),
        "fix_message_count": lf.get("fix_message_count", 0),
        "filepath": lf.get("filepath", ""),
    }


# ---------------------------------------------------------------------------
# New datasource-backed endpoints
# ---------------------------------------------------------------------------


@router.get("/files", summary="List system log files (datasource)")
async def list_log_files(
    _: CurrentUser,
    module: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Dict[str, Any]:
    """Return metadata for all parsed log files from the Datasource folder."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    log_files = ds.get_logs(module=module)

    total = len(log_files)
    start = (page - 1) * page_size
    items = [_logfile_to_summary(lf, i + start + 1) for i, lf in enumerate(log_files[start: start + page_size])]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, math.ceil(total / page_size)) if total > 0 else 1,
    }


@router.get("/files/{filename}/entries", summary="Get log entries for a file")
async def get_log_entries(
    filename: str,
    _: CurrentUser,
    level: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=2000),
    offset: int = Query(0, ge=0),
) -> Dict[str, Any]:
    """Return parsed log entries for a specific log file."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    log_files = ds.get_logs()

    target = next((lf for lf in log_files if lf.get("filename", "").lower() == filename.lower()), None)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Log file '{filename}' not found")

    entries = target.get("entries", [])
    if level:
        entries = [e for e in entries if e.get("level", "").upper() == level.upper()]

    total = len(entries)
    page_entries = entries[offset: offset + limit]

    return {
        "filename": filename,
        "module": target.get("module"),
        "total": total,
        "offset": offset,
        "limit": limit,
        "entries": page_entries,
    }


@router.get("/files/{filename}/analyze", summary="Analyze errors in a log file")
async def analyze_log_file(
    filename: str,
    _: CurrentUser,
) -> Dict[str, Any]:
    """Return an error summary and analysis for a specific log file."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    log_files = ds.get_logs()

    target = next((lf for lf in log_files if lf.get("filename", "").lower() == filename.lower()), None)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Log file '{filename}' not found")

    entries = target.get("entries", [])
    error_entries = [e for e in entries if e.get("level", "") in ("ERROR", "FATAL", "CRITICAL")]
    warn_entries = [e for e in entries if e.get("level", "") in ("WARN", "WARNING")]
    fix_entries = [e for e in entries if e.get("is_fix_message")]

    # Aggregate error messages
    from collections import Counter
    error_msgs = Counter(e.get("message", "")[:100] for e in error_entries)
    top_errors = [{"message": msg, "count": cnt} for msg, cnt in error_msgs.most_common(10)]

    return {
        "filename": filename,
        "module": target.get("module"),
        "total_lines": target.get("total_lines", 0),
        "error_count": target.get("error_count", 0),
        "warn_count": target.get("warn_count", 0),
        "fix_message_count": target.get("fix_message_count", 0),
        "top_errors": top_errors,
        "sample_errors": [
            {
                "timestamp": e.get("timestamp"),
                "level": e.get("level"),
                "component": e.get("component"),
                "message": e.get("message", "")[:300],
            }
            for e in error_entries[:10]
        ],
        "sample_warnings": [
            {
                "timestamp": e.get("timestamp"),
                "level": e.get("level"),
                "message": e.get("message", "")[:300],
            }
            for e in warn_entries[:5]
        ],
    }


# ---------------------------------------------------------------------------
# Mock data (kept for audit log fallback)
# ---------------------------------------------------------------------------

def _mock_audit_logs() -> List[dict]:
    now = datetime.now(timezone.utc)
    entries = [
        ("user_login", "auth", None, "User logged in", "192.168.1.10"),
        ("release_created", "release", "mock-rel-002", "Created release v2.5.0", "192.168.1.10"),
        ("issue_updated", "issue", "mock-issue-001", "Status changed to in_progress", "192.168.1.15"),
        ("user_created", "user", "mock-user-003", "New user user2 created", "192.168.1.10"),
        ("release_deployed", "release", "mock-rel-001", "Deployed to production", "192.168.1.20"),
        ("password_changed", "auth", None, "User changed password", "192.168.1.15"),
        ("user_login", "auth", None, "User logged in", "10.0.0.5"),
        ("document_uploaded", "document", "mock-doc-001", "Uploaded release_notes.pdf", "192.168.1.10"),
        ("issue_created", "issue", "mock-issue-010", "Created bug RIQ-421", "192.168.1.15"),
        ("release_status_changed", "release", "mock-rel-002", "Status changed to testing", "192.168.1.20"),
    ]
    return [
        {
            "id": f"mock-log-{i:03d}",
            "user_id": "mock-user-001",
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "detail": detail,
            "ip_address": ip,
            "created_at": now - timedelta(hours=i * 2),
            "user": {
                "id": "mock-user-001",
                "username": "admin",
                "full_name": "System Administrator",
                "email": "admin@releaseiq.com",
                "role": "admin",
            },
        }
        for i, (action, resource_type, resource_id, detail, ip) in enumerate(entries, start=1)
    ]


def _mock_deployment_logs() -> List[dict]:
    now = datetime.now(timezone.utc)
    return [
        {
            "timestamp": (now - timedelta(hours=i)).isoformat(),
            "level": "INFO" if i % 3 != 0 else "WARNING",
            "message": msg,
            "environment": env,
            "release_version": ver,
        }
        for i, (msg, env, ver) in enumerate(
            [
                ("Deployment started", "production", "2.4.0"),
                ("Running pre-deployment checks", "production", "2.4.0"),
                ("Database migration completed", "production", "2.4.0"),
                ("Application containers updated", "production", "2.4.0"),
                ("Health check passed", "production", "2.4.0"),
                ("Deployment completed successfully", "production", "2.4.0"),
                ("Deployment started", "staging", "2.5.0-rc1"),
                ("Running automated tests", "staging", "2.5.0-rc1"),
                ("3 tests failed - see report", "staging", "2.5.0-rc1"),
                ("Deployment completed with warnings", "staging", "2.5.0-rc1"),
            ],
            start=1,
        )
    ]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/audit", response_model=AuditLogListResponse, summary="List audit logs (admin)")
async def list_audit_logs(
    _: AdminUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> AuditLogListResponse:
    stmt = select(AuditLog)
    count_stmt = select(func.count()).select_from(AuditLog)

    filters = []
    if user_id:
        filters.append(AuditLog.user_id == user_id)
    if action:
        filters.append(AuditLog.action.ilike(f"%{action}%"))
    if resource_type:
        filters.append(AuditLog.resource_type == resource_type)

    for f in filters:
        stmt = stmt.where(f)
        count_stmt = count_stmt.where(f)

    total_result = await db.execute(count_stmt)
    total: int = total_result.scalar_one()

    if total == 0:
        mock = _mock_audit_logs()
        total = len(mock)
        start = (page - 1) * page_size
        return AuditLogListResponse(
            items=[AuditLogResponse(**entry) for entry in mock[start: start + page_size]],
            total=total,
            page=page,
            page_size=page_size,
            pages=max(1, math.ceil(total / page_size)),
        )

    offset = (page - 1) * page_size
    stmt = stmt.order_by(AuditLog.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(stmt)
    logs = list(result.scalars().all())

    return AuditLogListResponse(
        items=[AuditLogResponse.model_validate(log) for log in logs],
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/deployments", summary="List deployment logs")
async def list_deployment_logs(
    _: CurrentUser,
    environment: Optional[str] = Query(None),
    release_version: Optional[str] = Query(None),
) -> dict:
    """Return deployment log entries, combining datasource log data with mock deployment events."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    logs_data = ds.get_logs()

    deployment_logs = []
    for lf in logs_data:
        for entry in lf.get("entries", [])[:5]:
            deployment_logs.append({
                "timestamp": entry.get("timestamp"),
                "level": entry.get("level", "INFO"),
                "message": entry.get("message", ""),
                "environment": "LIVE",
                "release_version": "v9.48",
                "source_file": lf.get("filename"),
            })

    if not deployment_logs:
        deployment_logs = _mock_deployment_logs()

    if environment:
        deployment_logs = [l for l in deployment_logs if l.get("environment", "").lower() == environment.lower()]
    if release_version:
        deployment_logs = [l for l in deployment_logs if release_version in l.get("release_version", "")]

    return {"items": deployment_logs[:100], "total": len(deployment_logs)}


@router.get("/audit/{log_id}", response_model=AuditLogResponse, summary="Get audit log entry")
async def get_audit_log(
    log_id: str,
    _: AdminUser,
    db: AsyncSession = Depends(get_db),
) -> AuditLogResponse:
    result = await db.execute(select(AuditLog).where(AuditLog.id == log_id))
    log = result.scalar_one_or_none()

    if log is None:
        mock = {e["id"]: e for e in _mock_audit_logs()}
        if log_id in mock:
            return AuditLogResponse(**mock[log_id])
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log entry not found")

    return AuditLogResponse.model_validate(log)


@router.get("/system", summary="Get system event log (admin)")
async def get_system_logs(
    _: AdminUser,
    level: Optional[str] = Query(None, pattern="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$"),
    limit: int = Query(100, ge=1, le=500),
) -> dict:
    """Return recent system log entries (mock for now)."""
    now = datetime.now(timezone.utc)
    levels = ["DEBUG", "INFO", "INFO", "INFO", "WARNING", "ERROR"]
    messages = [
        "Application started",
        "Database connection established",
        "User authenticated: admin",
        "Release data fetched",
        "Slow query detected (>500ms)",
        "Failed to connect to Ollama",
        "Celery worker heartbeat",
        "Cache hit for analytics query",
        "WebSocket client connected",
        "Background task completed",
    ]

    entries = [
        {
            "timestamp": (now - timedelta(minutes=i * 5)).isoformat(),
            "level": levels[i % len(levels)],
            "logger": "releaseiq.app",
            "message": messages[i % len(messages)],
            "trace_id": f"trace-{i:06d}",
        }
        for i in range(min(limit, 50))
    ]

    if level:
        entries = [e for e in entries if e["level"] == level]

    return {"items": entries, "total": len(entries)}

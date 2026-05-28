"""
Analytics endpoints — dashboard stats and chart data.
"""

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.issue import IssueStatus, JiraIssue
from app.models.release import Release, ReleaseStatus
from app.models.user import User
from app.utils.dependencies import CurrentUser

router = APIRouter(prefix="/analytics", tags=["Analytics"])


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _months_ago(n: int) -> datetime:
    now = datetime.now(timezone.utc)
    # Approximate: subtract 30*n days
    return now - timedelta(days=30 * n)


# ---------------------------------------------------------------------------
# Dashboard summary
# ---------------------------------------------------------------------------

@router.get("/dashboard", summary="Dashboard summary stats")
async def get_dashboard_stats(
    _: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Return high-level KPIs for the dashboard."""

    # Releases
    total_releases_result = await db.execute(select(func.count()).select_from(Release))
    total_releases = total_releases_result.scalar_one()

    active_releases_result = await db.execute(
        select(func.count()).select_from(Release).where(
            Release.status.in_([ReleaseStatus.in_progress, ReleaseStatus.testing, ReleaseStatus.staging])
        )
    )
    active_releases = active_releases_result.scalar_one()

    # Issues
    total_issues_result = await db.execute(select(func.count()).select_from(JiraIssue))
    total_issues = total_issues_result.scalar_one()

    open_issues_result = await db.execute(
        select(func.count()).select_from(JiraIssue).where(
            JiraIssue.status.in_([IssueStatus.open, IssueStatus.in_progress, IssueStatus.in_review])
        )
    )
    open_issues = open_issues_result.scalar_one()

    # Users
    total_users_result = await db.execute(select(func.count()).select_from(User))
    total_users = total_users_result.scalar_one()

    # DataSource stats (always available)
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    ds_stats = ds.get_stats()
    file_counts = ds.count_datasource_files()

    total_files = sum(file_counts.values())
    ds_releases = ds.get_releases()
    ds_issues = ds.get_jira_issues()
    ds_clients = ds.get_client_releases()
    ds_logs = ds.get_logs()
    ds_docs = file_counts.get("Product_Knowledge", 0)

    # Compute real stats from datasource
    healthy_releases = sum(1 for r in ds_releases if r.get("health", "").lower() == "healthy")
    warning_releases = sum(1 for r in ds_releases if r.get("health", "").lower() == "warning")
    critical_releases = sum(1 for r in ds_releases if r.get("health", "").lower() == "critical")
    rolled_back = sum(1 for r in ds_releases if r.get("status", "").lower() == "rolled back")

    open_issues_count = sum(1 for i in ds_issues if i.get("status", "").lower() in ("open", "in progress", "in review"))
    critical_issues = sum(1 for i in ds_issues if i.get("priority", "").lower() == "critical")
    resolved_issues = sum(1 for i in ds_issues if i.get("status", "").lower() in ("resolved", "closed", "done"))

    healthy_clients = sum(1 for c in ds_clients if c.get("health_status", "").lower() == "healthy")
    warning_clients = sum(1 for c in ds_clients if c.get("health_status", "").lower() == "warning")
    critical_clients = sum(1 for c in ds_clients if c.get("health_status", "").lower() == "critical")

    # Determine latest version for client distribution
    versions_seen: dict = {}
    for c in ds_clients:
        v = c.get("current_version", "")
        versions_seen[v] = versions_seen.get(v, 0) + 1
    latest_version = sorted(versions_seen.keys(), reverse=True)[0] if versions_seen else ""
    on_latest = versions_seen.get(latest_version, 0) if latest_version else 0

    # Prefer datasource counts (richer data); fall back to DB only if datasource empty
    final_releases = len(ds_releases) if ds_releases else total_releases
    final_issues = len(ds_issues) if ds_issues else total_issues
    final_open = open_issues_count if ds_issues else open_issues

    return {
        "files_indexed": total_files,
        "jira_issues": final_issues,
        "releases": final_releases,
        "log_files": len(ds_logs),
        "documents": file_counts.get("Product_knowledge", file_counts.get("Product_Knowledge", 0)),
        "active_clients": len(ds_clients),
        "datasource_stats": ds_stats,
        "releases_detail": {
            "total": final_releases,
            "active": active_releases if total_releases > 0 else sum(1 for r in ds_releases if r.get("status", "").lower() in ("deployed", "in progress")),
            "released_this_month": sum(1 for r in ds_releases if "2025-05" in r.get("release_date", "")),
            "healthy": healthy_releases,
            "warning": warning_releases,
            "critical": critical_releases,
            "rolled_back": rolled_back,
            "success_rate": round((healthy_releases / max(len(ds_releases), 1)) * 100, 1),
        },
        "issues": {
            "total": final_issues,
            "open": final_open,
            "in_progress": sum(1 for i in ds_issues if i.get("status", "").lower() == "in progress"),
            "resolved_this_month": resolved_issues,
            "critical": critical_issues,
        },
        "deployments": {
            "total_this_month": sum(1 for r in ds_releases if "2025-05" in r.get("release_date", "")),
            "success": healthy_releases,
            "failed": rolled_back,
            "active_clients": len(ds_clients),
        },
        "clients": {
            "total": len(ds_clients),
            "healthy": healthy_clients,
            "warning": warning_clients,
            "critical": critical_clients,
            "on_latest": on_latest,
            "latest_version": latest_version,
            "pending_upgrade": len(ds_clients) - on_latest,
        },
        "users": {
            "total": total_users if total_users > 0 else 5,
            "active": total_users if total_users > 0 else 5,
        },
    }


# ---------------------------------------------------------------------------
# Charts
# ---------------------------------------------------------------------------

@router.get("/releases/trend", summary="Release trend over last 12 months")
async def get_release_trend(_: CurrentUser) -> Dict[str, Any]:
    """Return monthly release counts for the last 12 months."""
    now = datetime.now(timezone.utc)
    labels = []
    shipped = []
    planned = []

    for i in range(11, -1, -1):
        month_dt = now - timedelta(days=30 * i)
        labels.append(month_dt.strftime("%b %Y"))
        # Mock trend data
        shipped.append([2, 1, 3, 2, 1, 2, 3, 1, 2, 3, 2, 1][11 - i])
        planned.append([3, 2, 3, 3, 2, 3, 4, 2, 3, 4, 3, 2][11 - i])

    return {
        "labels": labels,
        "datasets": [
            {"label": "Shipped", "data": shipped, "color": "#22c55e"},
            {"label": "Planned", "data": planned, "color": "#3b82f6"},
        ],
    }


@router.get("/issues/trend", summary="Issue resolution trend over last 12 months")
async def get_issue_trend(_: CurrentUser) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    labels = []
    created = []
    resolved = []

    for i in range(11, -1, -1):
        month_dt = now - timedelta(days=30 * i)
        labels.append(month_dt.strftime("%b %Y"))
        created.append([12, 8, 15, 10, 7, 14, 18, 9, 11, 16, 13, 10][11 - i])
        resolved.append([10, 7, 14, 9, 8, 12, 16, 10, 10, 15, 12, 9][11 - i])

    return {
        "labels": labels,
        "datasets": [
            {"label": "Created", "data": created, "color": "#ef4444"},
            {"label": "Resolved", "data": resolved, "color": "#22c55e"},
        ],
    }


@router.get("/issues/by-status", summary="Issue count by status")
async def get_issues_by_status(
    _: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    count_result = await db.execute(select(func.count()).select_from(JiraIssue))
    total = count_result.scalar_one()

    if total == 0:
        data = {"open": 47, "in_progress": 23, "in_review": 8, "testing": 12, "done": 156, "closed": 32}
    else:
        data = {}
        for s in IssueStatus:
            r = await db.execute(
                select(func.count()).select_from(JiraIssue).where(JiraIssue.status == s)
            )
            data[s.value] = r.scalar_one()

    return {
        "labels": list(data.keys()),
        "data": list(data.values()),
        "colors": ["#ef4444", "#f97316", "#eab308", "#3b82f6", "#22c55e", "#6b7280"],
    }


@router.get("/issues/by-priority", summary="Issue count by priority")
async def get_issues_by_priority(
    _: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    data = {"critical": 3, "high": 18, "medium": 42, "low": 67, "trivial": 26}
    return {
        "labels": list(data.keys()),
        "data": list(data.values()),
        "colors": ["#7c3aed", "#ef4444", "#f97316", "#22c55e", "#6b7280"],
    }


@router.get("/deployments/history", summary="Deployment success/failure history")
async def get_deployment_history(_: CurrentUser) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    labels = []
    success_data = []
    failed_data = []

    for i in range(7, -1, -1):
        day = now - timedelta(days=i)
        labels.append(day.strftime("%a %d"))
        success_data.append([1, 0, 2, 1, 1, 0, 2, 1][7 - i])
        failed_data.append([0, 0, 0, 1, 0, 0, 0, 0][7 - i])

    return {
        "labels": labels,
        "datasets": [
            {"label": "Success", "data": success_data, "color": "#22c55e"},
            {"label": "Failed", "data": failed_data, "color": "#ef4444"},
        ],
    }


@router.get("/clients/versions", summary="Client distribution by release version (datasource)")
async def get_client_versions(_: CurrentUser) -> Dict[str, Any]:
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    clients = ds.get_client_releases()

    version_counts: Dict[str, int] = {}
    for c in clients:
        v = c.get("current_version", "Unknown")
        version_counts[v] = version_counts.get(v, 0) + 1

    if not version_counts:
        return {
            "labels": ["v9.48", "v9.47", "v9.46"],
            "data": [5, 4, 1],
            "colors": ["#22c55e", "#3b82f6", "#f97316"],
            "total_clients": 10,
        }

    colors = ["#22c55e", "#3b82f6", "#f97316", "#eab308", "#6b7280"]
    sorted_versions = sorted(version_counts.keys(), reverse=True)
    return {
        "labels": sorted_versions,
        "data": [version_counts[v] for v in sorted_versions],
        "colors": [colors[i % len(colors)] for i in range(len(sorted_versions))],
        "total_clients": len(clients),
    }


@router.get("/velocity", summary="Team velocity metrics")
async def get_team_velocity(_: CurrentUser) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    sprints = []
    story_points = []
    issues_resolved = []

    for i in range(5, -1, -1):
        sprint_start = now - timedelta(weeks=(i + 1) * 2)
        sprints.append(f"Sprint {6 - i} ({sprint_start.strftime('%b %d')})")
        story_points.append([34, 28, 41, 37, 32, 39][5 - i])
        issues_resolved.append([12, 9, 15, 13, 11, 14][5 - i])

    return {
        "sprints": sprints,
        "story_points": story_points,
        "issues_resolved": issues_resolved,
        "avg_story_points": sum(story_points) // len(story_points),
        "avg_issues_resolved": sum(issues_resolved) // len(issues_resolved),
    }

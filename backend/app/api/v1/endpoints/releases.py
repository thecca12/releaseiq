"""
Releases endpoints — GET uses DataSourceManager (real files), write ops use DB.
"""

import math
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.models.release import (
    ClientRelease,
    DeploymentHistory,
    Release,
    ReleaseStatus,
)
from app.schemas.release import (
    ClientReleaseResponse,
    DeploymentHistoryResponse,
    ReleaseCreate,
    ReleaseListResponse,
    ReleaseResponse,
    ReleaseUpdate,
)
from app.utils.dependencies import CurrentUser, ManagerUser

router = APIRouter(prefix="/releases", tags=["Releases"])
logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Datasource helpers
# ---------------------------------------------------------------------------

def _ds_release_to_response(r: Dict[str, Any], idx: int) -> Dict[str, Any]:
    """Convert a datasource release dict to a ReleaseResponse-compatible dict."""
    now = datetime.now(timezone.utc)
    return {
        "id": f"ds-rel-{idx:03d}",
        "version": r.get("version", ""),
        "name": f"Release {r.get('version', '')}",
        "description": r.get("notes", ""),
        "status": _map_ds_status(r.get("status", "")),
        "planned_date": None,
        "release_date": _parse_date(r.get("release_date")),
        "created_at": _parse_date(r.get("release_date")) or now,
        "updated_at": now,
        "release_notes": r.get("notes", ""),
        "created_by": r.get("owner", ""),
        "approved_by": None,
        "jira_project_key": "JIRA",
        "issue_count": r.get("open_issues", 0),
        "fixed_issue_count": 0,
        "tags": r.get("modules", []),
        # Extra datasource fields
        "environment": r.get("environment"),
        "health": r.get("health"),
        "health_color": r.get("health_color"),
        "owner": r.get("owner"),
        "modules": r.get("modules", []),
        "open_issues": r.get("open_issues", 0),
        "critical_issues": r.get("critical_issues", 0),
    }


def _map_ds_status(status_str: str) -> ReleaseStatus:
    s = status_str.lower()
    if s == "deployed":
        return ReleaseStatus.released
    if s == "rolled back":
        return ReleaseStatus.cancelled
    if s == "in progress":
        return ReleaseStatus.in_progress
    if s == "planned":
        return ReleaseStatus.planned
    return ReleaseStatus.released


def _parse_date(date_str: Optional[str]) -> Optional[datetime]:
    if not date_str:
        return None
    from datetime import date
    import re
    # Handle YYYY-MM-DD
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", date_str)
    if m:
        try:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=timezone.utc)
        except ValueError:
            pass
    return None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=ReleaseListResponse, summary="List releases (datasource)")
async def list_releases(
    _: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    release_status: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    env: Optional[str] = Query(None),
    version: Optional[str] = Query(None),
    health: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> ReleaseListResponse:
    """
    List releases. Reads from DataSourceManager (real files).
    Falls back to DB releases if datasource is empty.
    """
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    ds_releases = ds.get_releases(env=env, version=version, health=health)

    if release_status:
        mapped = _map_ds_status(release_status)
        ds_releases = [r for r in ds_releases if _map_ds_status(r.get("status", "")) == mapped]

    if search:
        s = search.lower()
        ds_releases = [
            r for r in ds_releases
            if s in r.get("version", "").lower()
            or s in r.get("notes", "").lower()
            or s in ",".join(r.get("modules", [])).lower()
        ]

    if ds_releases:
        total = len(ds_releases)
        start = (page - 1) * page_size
        page_items = ds_releases[start: start + page_size]
        response_items = []
        for idx, r in enumerate(page_items, start=start + 1):
            try:
                response_items.append(ReleaseResponse(**_ds_release_to_response(r, idx)))
            except Exception as e:
                logger.warning(f"Could not build ReleaseResponse for {r.get('version')}: {e}")
        return ReleaseListResponse(
            items=response_items,
            total=total,
            page=page,
            page_size=page_size,
            pages=max(1, math.ceil(total / page_size)),
        )

    # Fallback: DB
    stmt = select(Release)
    count_stmt = select(func.count()).select_from(Release)
    total_result = await db.execute(count_stmt)
    total: int = total_result.scalar_one()
    if total == 0:
        return ReleaseListResponse(items=[], total=0, page=page, page_size=page_size, pages=1)

    offset = (page - 1) * page_size
    stmt = stmt.order_by(Release.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(stmt)
    releases = list(result.scalars().all())
    return ReleaseListResponse(
        items=[ReleaseResponse.model_validate(r) for r in releases],
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, math.ceil(total / page_size)),
    )


@router.post("", response_model=ReleaseResponse, status_code=status.HTTP_201_CREATED, summary="Create release")
async def create_release(
    body: ReleaseCreate,
    current_user: ManagerUser,
    db: AsyncSession = Depends(get_db),
) -> ReleaseResponse:
    release = Release(
        **body.model_dump(),
        created_by=current_user.username,
    )
    db.add(release)
    await db.flush()
    await db.refresh(release)
    logger.info("release_created", release_id=release.id, version=release.version)
    return ReleaseResponse.model_validate(release)


@router.get("/{release_id}", response_model=ReleaseResponse, summary="Get release by ID")
async def get_release(
    release_id: str,
    _: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> ReleaseResponse:
    # Try DB first
    result = await db.execute(select(Release).where(Release.id == release_id))
    release = result.scalar_one_or_none()
    if release is not None:
        return ReleaseResponse.model_validate(release)

    # Try datasource (id format: ds-rel-NNN or version string)
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()

    # Try by version (e.g., "v9.48")
    version_matches = ds.get_releases(version=release_id)
    if version_matches:
        return ReleaseResponse(**_ds_release_to_response(version_matches[0], 1))

    # Try by ds-rel-NNN index
    if release_id.startswith("ds-rel-"):
        try:
            idx = int(release_id.split("-")[-1]) - 1
            all_releases = ds.get_releases()
            if 0 <= idx < len(all_releases):
                return ReleaseResponse(**_ds_release_to_response(all_releases[idx], idx + 1))
        except (ValueError, IndexError):
            pass

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release not found")


@router.put("/{release_id}", response_model=ReleaseResponse, summary="Update release")
async def update_release(
    release_id: str,
    body: ReleaseUpdate,
    _: ManagerUser,
    db: AsyncSession = Depends(get_db),
) -> ReleaseResponse:
    result = await db.execute(select(Release).where(Release.id == release_id))
    release = result.scalar_one_or_none()

    if release is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(release, field, value)

    db.add(release)
    await db.flush()
    await db.refresh(release)
    return ReleaseResponse.model_validate(release)


@router.delete("/{release_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete release")
async def delete_release(
    release_id: str,
    _: ManagerUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(Release).where(Release.id == release_id))
    release = result.scalar_one_or_none()

    if release is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release not found")

    await db.delete(release)


@router.get("/{release_id}/clients", response_model=List[ClientReleaseResponse], summary="Get clients for a release")
async def get_release_clients(
    release_id: str,
    _: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> List[ClientReleaseResponse]:
    result = await db.execute(
        select(ClientRelease).where(ClientRelease.release_id == release_id)
    )
    clients = list(result.scalars().all())

    if not clients:
        # Try datasource for clients matching this release
        from app.services.datasource.manager import get_datasource_manager
        ds = get_datasource_manager()
        ds_clients = ds.get_client_releases(version=release_id)
        if ds_clients:
            now = datetime.now(timezone.utc)
            return [
                ClientReleaseResponse(
                    id=f"ds-cr-{c.get('client_id')}",
                    release_id=release_id,
                    client_id=c.get("client_id", ""),
                    client_name=c.get("client_name", ""),
                    environment=c.get("environment", ""),
                    deployed_at=_parse_date(c.get("deployment_date")),
                    is_deployed=bool(c.get("deployment_date")),
                    deployment_notes=c.get("notes"),
                    created_at=now,
                )
                for c in ds_clients
            ]
        return []

    return [ClientReleaseResponse.model_validate(c) for c in clients]


@router.get("/{release_id}/deployments", response_model=List[DeploymentHistoryResponse], summary="Get deployments for a release")
async def get_release_deployments(
    release_id: str,
    _: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> List[DeploymentHistoryResponse]:
    result = await db.execute(
        select(DeploymentHistory).where(DeploymentHistory.release_id == release_id)
    )
    deployments = list(result.scalars().all())

    if not deployments:
        return []

    return [DeploymentHistoryResponse.model_validate(d) for d in deployments]

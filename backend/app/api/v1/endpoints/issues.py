"""
Issues (Jira) endpoints — GET uses DataSourceManager, write ops use DB.
"""

import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.issue import IssuePriority, IssueStatus, IssueType, JiraIssue
from app.schemas.issue import (
    IssueCreate,
    IssueListResponse,
    IssueResponse,
    IssueStatsResponse,
    IssueUpdate,
)
from app.utils.dependencies import CurrentUser, ManagerUser

router = APIRouter(prefix="/issues", tags=["Issues"])


# ---------------------------------------------------------------------------
# Datasource helpers
# ---------------------------------------------------------------------------

def _ds_issue_to_response(issue: Dict[str, Any], idx: int) -> Dict[str, Any]:
    """Convert a datasource Jira issue dict to an IssueResponse-compatible dict."""
    now = datetime.now(timezone.utc)
    return {
        "id": f"ds-issue-{idx:04d}",
        "jira_key": issue.get("jira_id", ""),
        "jira_id": issue.get("jira_id", ""),
        "project_key": "JIRA",
        "project_name": "ReleaseIQ",
        "summary": issue.get("title", ""),
        "description": issue.get("description", ""),
        "issue_type": _map_issue_type(issue.get("type", "")),
        "status": _map_issue_status(issue.get("status", "")),
        "priority": _map_priority(issue.get("priority", "")),
        "reporter": issue.get("reporter", ""),
        "assignee": issue.get("assignee") or None,
        "created_at": _parse_date(issue.get("created_date")) or now,
        "updated_at": _parse_date(issue.get("updated_date")) or now,
        "resolved_at": _parse_date(issue.get("updated_date")) if issue.get("status", "").lower() in ("resolved", "closed", "done") else None,
        "due_date": None,
        "release_id": None,
        "fix_version": issue.get("fix_version") or None,
        "labels": [],
        "components": [issue.get("module")] if issue.get("module") else [],
        "story_points": None,
        "jira_url": issue.get("jira_url") or None,
        # Extra fields
        "module": issue.get("module"),
        "affected_version": issue.get("affected_version"),
        "environment": issue.get("environment"),
    }


def _map_issue_status(s: str) -> IssueStatus:
    mapping = {
        "open": IssueStatus.open,
        "in progress": IssueStatus.in_progress,
        "in review": IssueStatus.in_review,
        "resolved": IssueStatus.done,
        "closed": IssueStatus.closed,
        "done": IssueStatus.done,
        "testing": IssueStatus.testing,
    }
    return mapping.get(s.lower(), IssueStatus.open)


def _map_priority(p: str) -> IssuePriority:
    mapping = {
        "critical": IssuePriority.critical,
        "high": IssuePriority.high,
        "medium": IssuePriority.medium,
        "low": IssuePriority.low,
        "trivial": IssuePriority.trivial,
    }
    return mapping.get(p.lower(), IssuePriority.medium)


def _map_issue_type(t: str) -> IssueType:
    mapping = {
        "bug": IssueType.bug,
        "feature": IssueType.feature,
        "improvement": IssueType.improvement,
        "task": IssueType.task,
        "story": IssueType.story,
        "performance": IssueType.task,
        "epic": IssueType.epic,
    }
    return mapping.get(t.lower(), IssueType.bug)


def _parse_date(date_str: Optional[str]) -> Optional[datetime]:
    if not date_str:
        return None
    import re
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

@router.get("", response_model=IssueListResponse, summary="List issues (datasource)")
async def list_issues(
    _: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    issue_status: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = Query(None),
    issue_type: Optional[str] = Query(None, alias="type"),
    release_id: Optional[str] = Query(None),
    assignee: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> IssueListResponse:
    """List Jira issues from DataSourceManager. Falls back to DB."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    ds_issues = ds.get_jira_issues(
        status=issue_status,
        priority=priority,
        module=module,
        assignee=assignee,
        search=search,
    )

    if ds_issues:
        total = len(ds_issues)
        start = (page - 1) * page_size
        page_items = ds_issues[start: start + page_size]
        response_items = []
        for idx, issue in enumerate(page_items, start=start + 1):
            try:
                response_items.append(IssueResponse(**_ds_issue_to_response(issue, idx)))
            except Exception as e:
                pass
        return IssueListResponse(
            items=response_items,
            total=total,
            page=page,
            page_size=page_size,
            pages=max(1, math.ceil(total / page_size)),
        )

    # Fallback: DB
    stmt = select(JiraIssue)
    count_stmt = select(func.count()).select_from(JiraIssue)
    total_result = await db.execute(count_stmt)
    total: int = total_result.scalar_one()
    if total == 0:
        return IssueListResponse(items=[], total=0, page=page, page_size=page_size, pages=1)

    offset = (page - 1) * page_size
    stmt = stmt.order_by(JiraIssue.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(stmt)
    issues = list(result.scalars().all())
    return IssueListResponse(
        items=[IssueResponse.model_validate(i) for i in issues],
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, math.ceil(total / page_size)),
    )


@router.post("", response_model=IssueResponse, status_code=status.HTTP_201_CREATED, summary="Create issue")
async def create_issue(
    body: IssueCreate,
    _: ManagerUser,
    db: AsyncSession = Depends(get_db),
) -> IssueResponse:
    # Check for duplicate jira_key
    result = await db.execute(
        select(JiraIssue).where(JiraIssue.jira_key == body.jira_key)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Issue with key '{body.jira_key}' already exists",
        )

    issue = JiraIssue(**body.model_dump())
    db.add(issue)
    await db.flush()
    await db.refresh(issue)
    return IssueResponse.model_validate(issue)


@router.get("/stats", response_model=IssueStatsResponse, summary="Issue statistics (datasource)")
async def get_issue_stats(
    _: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> IssueStatsResponse:
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    ds_issues = ds.get_jira_issues()

    if ds_issues:
        by_status: Dict[str, int] = {}
        by_priority: Dict[str, int] = {}
        by_type: Dict[str, int] = {}
        for issue in ds_issues:
            s = _map_issue_status(issue.get("status", "")).value
            by_status[s] = by_status.get(s, 0) + 1
            p = _map_priority(issue.get("priority", "")).value
            by_priority[p] = by_priority.get(p, 0) + 1
            t = _map_issue_type(issue.get("type", "")).value
            by_type[t] = by_type.get(t, 0) + 1
        return IssueStatsResponse(
            total=len(ds_issues),
            by_status=by_status,
            by_priority=by_priority,
            by_type=by_type,
        )

    # Fallback: DB
    count_result = await db.execute(select(func.count()).select_from(JiraIssue))
    total = count_result.scalar_one()
    if total == 0:
        return IssueStatsResponse(total=0, by_status={}, by_priority={}, by_type={})

    by_status = {}
    by_priority = {}
    by_type = {}
    for s in IssueStatus:
        r = await db.execute(select(func.count()).select_from(JiraIssue).where(JiraIssue.status == s))
        by_status[s.value] = r.scalar_one()
    for p in IssuePriority:
        r = await db.execute(select(func.count()).select_from(JiraIssue).where(JiraIssue.priority == p))
        by_priority[p.value] = r.scalar_one()
    for t in IssueType:
        r = await db.execute(select(func.count()).select_from(JiraIssue).where(JiraIssue.issue_type == t))
        by_type[t.value] = r.scalar_one()
    return IssueStatsResponse(total=total, by_status=by_status, by_priority=by_priority, by_type=by_type)


@router.post("/search", summary="Search Jira issues (datasource)")
async def search_issues(
    _: CurrentUser,
    query: str = Body(..., embed=True),
    module: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Dict[str, Any]:
    """Full-text search across Jira issues using DataSourceManager."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    results = ds.search_all(query)
    jira_results = [r for r in results if r.get("type") == "jira"]
    if module:
        jira_results = [r for r in jira_results if module.lower() in r.get("module", "").lower()]
    total = len(jira_results)
    start = (page - 1) * page_size
    return {
        "query": query,
        "total": total,
        "page": page,
        "page_size": page_size,
        "results": jira_results[start: start + page_size],
    }


@router.get("/{issue_id}", response_model=IssueResponse, summary="Get issue by ID")
async def get_issue(
    issue_id: str,
    _: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> IssueResponse:
    # Try DB
    result = await db.execute(select(JiraIssue).where(JiraIssue.id == issue_id))
    issue = result.scalar_one_or_none()
    if issue is not None:
        return IssueResponse.model_validate(issue)

    # Try datasource by JIRA-ID
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    ds_issue = ds.get_jira_issue_by_id(issue_id)
    if ds_issue:
        return IssueResponse(**_ds_issue_to_response(ds_issue, 1))

    # Try by datasource index
    if issue_id.startswith("ds-issue-"):
        try:
            idx = int(issue_id.split("-")[-1]) - 1
            all_issues = ds.get_jira_issues()
            if 0 <= idx < len(all_issues):
                return IssueResponse(**_ds_issue_to_response(all_issues[idx], idx + 1))
        except (ValueError, IndexError):
            pass

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")


@router.put("/{issue_id}", response_model=IssueResponse, summary="Update issue")
async def update_issue(
    issue_id: str,
    body: IssueUpdate,
    _: ManagerUser,
    db: AsyncSession = Depends(get_db),
) -> IssueResponse:
    result = await db.execute(select(JiraIssue).where(JiraIssue.id == issue_id))
    issue = result.scalar_one_or_none()

    if issue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(issue, field, value)

    db.add(issue)
    await db.flush()
    await db.refresh(issue)
    return IssueResponse.model_validate(issue)


@router.delete("/{issue_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete issue")
async def delete_issue(
    issue_id: str,
    _: ManagerUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(JiraIssue).where(JiraIssue.id == issue_id))
    issue = result.scalar_one_or_none()

    if issue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")

    await db.delete(issue)

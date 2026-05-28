"""
Issue-related Pydantic schemas.
"""

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from app.models.issue import IssueStatus, IssuePriority, IssueType


class IssueBase(BaseModel):
    jira_key: str = Field(..., min_length=1, max_length=50)
    project_key: str = Field(..., min_length=1, max_length=50)
    project_name: Optional[str] = None
    summary: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    issue_type: IssueType = IssueType.bug
    status: IssueStatus = IssueStatus.open
    priority: IssuePriority = IssuePriority.medium
    reporter: Optional[str] = None
    assignee: Optional[str] = None
    fix_version: Optional[str] = None
    labels: Optional[List[str]] = None
    components: Optional[List[str]] = None
    story_points: Optional[int] = None


class IssueCreate(IssueBase):
    release_id: Optional[str] = None
    jira_id: Optional[str] = None
    jira_url: Optional[str] = None
    custom_fields: Optional[Dict] = None


class IssueUpdate(BaseModel):
    summary: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    status: Optional[IssueStatus] = None
    priority: Optional[IssuePriority] = None
    assignee: Optional[str] = None
    fix_version: Optional[str] = None
    release_id: Optional[str] = None
    labels: Optional[List[str]] = None
    story_points: Optional[int] = None
    resolved_at: Optional[datetime] = None


class IssueResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    jira_key: str
    jira_id: Optional[str] = None
    project_key: str
    project_name: Optional[str] = None
    summary: str
    description: Optional[str] = None
    issue_type: IssueType
    status: IssueStatus
    priority: IssuePriority
    reporter: Optional[str] = None
    assignee: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    release_id: Optional[str] = None
    fix_version: Optional[str] = None
    labels: Optional[List[str]] = None
    components: Optional[List[str]] = None
    story_points: Optional[int] = None
    jira_url: Optional[str] = None


class IssueListResponse(BaseModel):
    items: List[IssueResponse]
    total: int
    page: int
    page_size: int
    pages: int


class IssueStatsResponse(BaseModel):
    total: int
    by_status: Dict[str, int]
    by_priority: Dict[str, int]
    by_type: Dict[str, int]

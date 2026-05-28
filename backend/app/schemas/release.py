"""
Release-related Pydantic schemas.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.release import ReleaseStatus


class ReleaseBase(BaseModel):
    version: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    status: ReleaseStatus = ReleaseStatus.planned
    planned_date: Optional[datetime] = None
    release_notes: Optional[str] = None
    jira_project_key: Optional[str] = None
    tags: Optional[List[str]] = None


class ReleaseCreate(ReleaseBase):
    pass


class ReleaseUpdate(BaseModel):
    version: Optional[str] = Field(None, min_length=1, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[ReleaseStatus] = None
    planned_date: Optional[datetime] = None
    release_date: Optional[datetime] = None
    release_notes: Optional[str] = None
    approved_by: Optional[str] = None
    tags: Optional[List[str]] = None


class ReleaseResponse(BaseModel):
    model_config = {"from_attributes": True, "extra": "allow"}

    id: str
    version: str
    name: str
    description: Optional[str] = None
    status: ReleaseStatus
    planned_date: Optional[datetime] = None
    release_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    release_notes: Optional[str] = None
    created_by: Optional[str] = None
    approved_by: Optional[str] = None
    jira_project_key: Optional[str] = None
    issue_count: int = 0
    fixed_issue_count: int = 0
    tags: Optional[List[str]] = None
    # Datasource-enriched fields
    health: Optional[str] = None
    health_color: Optional[str] = None
    environment: Optional[str] = None
    owner: Optional[str] = None
    modules: Optional[List[str]] = None
    open_issues: Optional[int] = None
    critical_issues: Optional[int] = None


class ReleaseListResponse(BaseModel):
    items: List[ReleaseResponse]
    total: int
    page: int
    page_size: int
    pages: int


class ClientReleaseCreate(BaseModel):
    release_id: str
    client_id: str
    client_name: str
    environment: str = "production"


class ClientReleaseResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    release_id: str
    client_id: str
    client_name: str
    environment: str
    deployed_at: Optional[datetime] = None
    is_deployed: bool
    deployment_notes: Optional[str] = None
    created_at: datetime


class DeploymentHistoryResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    release_id: str
    environment: str
    status: str
    deployed_by: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    commit_sha: Optional[str] = None
    pipeline_url: Optional[str] = None
    error_message: Optional[str] = None

"""
Meeting endpoints with mock data and AI-generated Minutes of Meeting (MOM).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.core.logging import get_logger
from app.utils.dependencies import CurrentUser

router = APIRouter(prefix="/meetings", tags=["Meetings"])
logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class Attendee(BaseModel):
    name: str
    email: str
    role: str = "attendee"  # host | attendee | optional


class ActionItem(BaseModel):
    description: str
    owner: str
    due_date: Optional[str] = None
    status: str = "open"  # open | done


class MeetingResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    meeting_type: str  # sprint_review | daily_standup | release_planning | incident | general
    status: str  # scheduled | in_progress | completed | cancelled
    scheduled_at: datetime
    duration_minutes: int
    location: Optional[str]
    meeting_url: Optional[str]
    attendees: list[Attendee]
    agenda: list[str]
    notes: Optional[str]
    action_items: list[ActionItem]
    mom_generated: bool
    created_by: str
    created_at: datetime
    updated_at: datetime


class MeetingList(BaseModel):
    items: list[MeetingResponse]
    total: int


class CreateMeetingRequest(BaseModel):
    title: str
    description: Optional[str] = None
    meeting_type: str = "general"
    scheduled_at: datetime
    duration_minutes: int = 60
    location: Optional[str] = None
    meeting_url: Optional[str] = None
    attendees: list[Attendee] = []
    agenda: list[str] = []


class UpdateMeetingRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None
    action_items: Optional[list[ActionItem]] = None


class MOMResponse(BaseModel):
    meeting_id: str
    mom_text: str
    generated_at: datetime
    model_used: str


# ---------------------------------------------------------------------------
# Mock data
# ---------------------------------------------------------------------------

_now = datetime.utcnow()

_MEETINGS: list[dict] = [
    {
        "id": "meet-001",
        "title": "v2.5.0 Release Planning",
        "description": "Plan the scope and timeline for v2.5.0 release",
        "meeting_type": "release_planning",
        "status": "completed",
        "scheduled_at": _now - timedelta(days=7),
        "duration_minutes": 90,
        "location": None,
        "meeting_url": "https://meet.company.com/rel-planning",
        "attendees": [
            {"name": "Alice Johnson", "email": "alice@company.com", "role": "host"},
            {"name": "Bob Smith", "email": "bob@company.com", "role": "attendee"},
            {"name": "Carol White", "email": "carol@company.com", "role": "attendee"},
        ],
        "agenda": [
            "Review v2.4.0 retrospective",
            "Define v2.5.0 scope",
            "Assign story points",
            "Set sprint milestones",
        ],
        "notes": (
            "Agreed to include 4 major features in v2.5.0.\n"
            "Sprint starts next Monday. Carol owns the new onboarding flow."
        ),
        "action_items": [
            {"description": "Create Jira epic for onboarding", "owner": "Carol", "due_date": "2025-06-01", "status": "done"},
            {"description": "Update roadmap document", "owner": "Alice", "due_date": "2025-06-03", "status": "open"},
        ],
        "mom_generated": True,
        "created_by": "alice@company.com",
        "created_at": _now - timedelta(days=8),
        "updated_at": _now - timedelta(days=7),
    },
    {
        "id": "meet-002",
        "title": "FIX Session Incident RCA Review",
        "description": "Review root cause of yesterday's FIX sequence gap",
        "meeting_type": "incident",
        "status": "completed",
        "scheduled_at": _now - timedelta(days=1),
        "duration_minutes": 45,
        "location": "War Room B",
        "meeting_url": None,
        "attendees": [
            {"name": "Dave Kumar", "email": "dave@company.com", "role": "host"},
            {"name": "Eve Chen", "email": "eve@company.com", "role": "attendee"},
        ],
        "agenda": [
            "Timeline of incident",
            "Root cause analysis",
            "Corrective actions",
            "Prevention measures",
        ],
        "notes": "Identified network timeout as root cause. ResendRequest fix deployed.",
        "action_items": [
            {"description": "Deploy ResendRequest auto-handler", "owner": "Eve", "due_date": "2025-06-05", "status": "done"},
            {"description": "Update runbook for FIX incidents", "owner": "Dave", "due_date": "2025-06-07", "status": "open"},
        ],
        "mom_generated": True,
        "created_by": "dave@company.com",
        "created_at": _now - timedelta(days=2),
        "updated_at": _now - timedelta(days=1),
    },
    {
        "id": "meet-003",
        "title": "Daily Standup – Sprint 24",
        "description": "Daily standup for sprint 24",
        "meeting_type": "daily_standup",
        "status": "scheduled",
        "scheduled_at": _now + timedelta(hours=2),
        "duration_minutes": 15,
        "location": None,
        "meeting_url": "https://meet.company.com/standup",
        "attendees": [
            {"name": "Engineering Team", "email": "engineering@company.com", "role": "attendee"},
        ],
        "agenda": ["Yesterday", "Today", "Blockers"],
        "notes": None,
        "action_items": [],
        "mom_generated": False,
        "created_by": "alice@company.com",
        "created_at": _now - timedelta(hours=1),
        "updated_at": _now - timedelta(hours=1),
    },
]

_MEETING_STORE: dict[str, dict] = {m["id"]: m for m in _MEETINGS}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=MeetingList, summary="List meetings")
async def list_meetings(
    current_user: CurrentUser,
    status_filter: Optional[str] = Query(None, alias="status"),
    meeting_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> MeetingList:
    """List all meetings with optional filters."""
    meetings = list(_MEETING_STORE.values())

    if status_filter:
        meetings = [m for m in meetings if m["status"] == status_filter]
    if meeting_type:
        meetings = [m for m in meetings if m["meeting_type"] == meeting_type]

    meetings.sort(key=lambda m: m["scheduled_at"], reverse=True)

    total = len(meetings)
    start = (page - 1) * page_size
    end = start + page_size

    return MeetingList(
        items=[MeetingResponse(**m) for m in meetings[start:end]],
        total=total,
    )


@router.post(
    "",
    response_model=MeetingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a meeting",
)
async def create_meeting(
    body: CreateMeetingRequest,
    current_user: CurrentUser,
) -> MeetingResponse:
    """Create a new meeting."""
    meeting_id = f"meet-{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow()

    meeting = {
        "id": meeting_id,
        "title": body.title,
        "description": body.description,
        "meeting_type": body.meeting_type,
        "status": "scheduled",
        "scheduled_at": body.scheduled_at,
        "duration_minutes": body.duration_minutes,
        "location": body.location,
        "meeting_url": body.meeting_url,
        "attendees": [a.model_dump() for a in body.attendees],
        "agenda": body.agenda,
        "notes": None,
        "action_items": [],
        "mom_generated": False,
        "created_by": current_user.email,
        "created_at": now,
        "updated_at": now,
    }

    _MEETING_STORE[meeting_id] = meeting
    logger.info("meeting_created", meeting_id=meeting_id, title=body.title)
    return MeetingResponse(**meeting)


@router.put("/{meeting_id}", response_model=MeetingResponse, summary="Update a meeting")
async def update_meeting(
    meeting_id: str,
    body: UpdateMeetingRequest,
    current_user: CurrentUser,
) -> MeetingResponse:
    """Update meeting details, notes, or action items."""
    meeting = _MEETING_STORE.get(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail=f"Meeting '{meeting_id}' not found")

    update_data = body.model_dump(exclude_none=True)
    if "action_items" in update_data:
        update_data["action_items"] = [ai.model_dump() for ai in (body.action_items or [])]

    meeting.update(update_data)
    meeting["updated_at"] = datetime.utcnow()

    logger.info("meeting_updated", meeting_id=meeting_id)
    return MeetingResponse(**meeting)


@router.post(
    "/{meeting_id}/generate-mom",
    response_model=MOMResponse,
    summary="Generate Minutes of Meeting",
)
async def generate_mom(
    meeting_id: str,
    current_user: CurrentUser,
) -> MOMResponse:
    """
    Generate AI-powered Minutes of Meeting (MOM) for a completed meeting.

    Uses Ollama if available; falls back to a structured template.
    """
    from app.services.ai_service import ai_service

    meeting = _MEETING_STORE.get(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail=f"Meeting '{meeting_id}' not found")

    attendee_names = ", ".join(a["name"] for a in meeting.get("attendees", []))
    agenda_text = "\n".join(f"  - {item}" for item in meeting.get("agenda", []))
    action_items_text = "\n".join(
        f"  - {ai['description']} (Owner: {ai['owner']}, Due: {ai.get('due_date', 'TBD')})"
        for ai in meeting.get("action_items", [])
    )

    prompt = (
        f"Generate professional Minutes of Meeting (MOM) for:\n\n"
        f"Meeting Title: {meeting['title']}\n"
        f"Date: {meeting['scheduled_at']}\n"
        f"Duration: {meeting['duration_minutes']} minutes\n"
        f"Attendees: {attendee_names}\n\n"
        f"Agenda:\n{agenda_text}\n\n"
        f"Notes:\n{meeting.get('notes') or 'No notes recorded'}\n\n"
        f"Action Items:\n{action_items_text or 'None'}\n\n"
        "Format the MOM with: Executive Summary, Discussion Points, Decisions Made, "
        "Action Items, Next Steps."
    )

    raw = await ai_service._generate_ollama(prompt)
    model_used = "ollama"

    if not raw:
        model_used = "template"
        raw = _generate_template_mom(meeting, attendee_names, agenda_text, action_items_text)

    # Store the MOM as notes
    meeting["notes"] = (meeting.get("notes") or "") + f"\n\n---MOM---\n{raw}"
    meeting["mom_generated"] = True
    meeting["updated_at"] = datetime.utcnow()

    logger.info("mom_generated", meeting_id=meeting_id, model=model_used)
    return MOMResponse(
        meeting_id=meeting_id,
        mom_text=raw,
        generated_at=datetime.utcnow(),
        model_used=model_used,
    )


def _generate_template_mom(
    meeting: dict,
    attendee_names: str,
    agenda_text: str,
    action_items_text: str,
) -> str:
    """Generate a structured MOM template without AI."""
    date_str = meeting["scheduled_at"].strftime("%Y-%m-%d %H:%M UTC") if isinstance(meeting["scheduled_at"], datetime) else str(meeting["scheduled_at"])

    return (
        f"# Minutes of Meeting\n\n"
        f"**Meeting:** {meeting['title']}\n"
        f"**Date:** {date_str}\n"
        f"**Duration:** {meeting['duration_minutes']} minutes\n"
        f"**Attendees:** {attendee_names or 'N/A'}\n\n"
        f"## Executive Summary\n\n"
        f"The meeting was held to discuss: {meeting.get('description') or meeting['title']}.\n\n"
        f"## Agenda\n\n{agenda_text or 'N/A'}\n\n"
        f"## Discussion Points\n\n"
        f"{meeting.get('notes') or 'No notes recorded.'}\n\n"
        f"## Action Items\n\n{action_items_text or 'No action items recorded.'}\n\n"
        f"## Next Steps\n\n"
        f"- Follow up on open action items\n"
        f"- Schedule next meeting as required\n\n"
        f"_Generated by ReleaseIQ_"
    )

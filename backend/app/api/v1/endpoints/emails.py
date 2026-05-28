"""
Email endpoints with mock data and AI-generated draft support.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, EmailStr

from app.core.logging import get_logger
from app.utils.dependencies import CurrentUser

router = APIRouter(prefix="/emails", tags=["Emails"])
logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class EmailAddress(BaseModel):
    name: str
    email: str


class EmailResponse(BaseModel):
    id: str
    subject: str
    sender: EmailAddress
    recipients: list[EmailAddress]
    cc: list[EmailAddress] = []
    body: str
    body_html: Optional[str] = None
    is_read: bool
    is_draft: bool
    has_attachments: bool
    labels: list[str] = []
    sent_at: Optional[datetime]
    created_at: datetime


class EmailList(BaseModel):
    items: list[EmailResponse]
    total: int


class SendEmailRequest(BaseModel):
    to: list[str]
    cc: list[str] = []
    subject: str
    body: str
    body_html: Optional[str] = None


class DraftRequest(BaseModel):
    context: str
    recipient: str
    tone: str = "professional"  # professional | casual | formal
    release_version: Optional[str] = None
    issue_ids: list[str] = []


class DraftResponse(BaseModel):
    subject: str
    body: str


# ---------------------------------------------------------------------------
# Mock data
# ---------------------------------------------------------------------------

_now = datetime.utcnow()

_MOCK_EMAILS: list[dict] = [
    {
        "id": "email-001",
        "subject": "Release v2.4.0 - Production Deployment Completed",
        "sender": {"name": "DevOps Team", "email": "devops@company.com"},
        "recipients": [{"name": "Engineering Team", "email": "engineering@company.com"}],
        "cc": [{"name": "Product Manager", "email": "pm@company.com"}],
        "body": (
            "Hi Team,\n\n"
            "We're pleased to announce that v2.4.0 has been successfully deployed to production.\n\n"
            "Key changes:\n"
            "- Fixed critical login timeout issue (RIQ-421)\n"
            "- Improved dashboard load time by 35%\n"
            "- Added bulk export functionality\n\n"
            "All health checks are passing. Monitor the dashboards for the next 24 hours.\n\n"
            "Regards,\nDevOps"
        ),
        "body_html": None,
        "is_read": True,
        "is_draft": False,
        "has_attachments": False,
        "labels": ["deployment", "production"],
        "sent_at": _now - timedelta(days=3),
        "created_at": _now - timedelta(days=3),
    },
    {
        "id": "email-002",
        "subject": "Client Acme Corp – Version Upgrade Request",
        "sender": {"name": "Sales Team", "email": "sales@company.com"},
        "recipients": [{"name": "Release Manager", "email": "release@company.com"}],
        "cc": [],
        "body": (
            "Hi,\n\n"
            "Acme Corp has requested an upgrade from v2.3.1 to v2.4.0.\n"
            "Their maintenance window is this Saturday 02:00-06:00 UTC.\n\n"
            "Please confirm availability and prepare the deployment checklist.\n\n"
            "Thanks"
        ),
        "body_html": None,
        "is_read": False,
        "is_draft": False,
        "has_attachments": False,
        "labels": ["client", "upgrade"],
        "sent_at": _now - timedelta(hours=5),
        "created_at": _now - timedelta(hours=5),
    },
    {
        "id": "email-003",
        "subject": "FIX Session Alert – Sequence Gap Detected",
        "sender": {"name": "Monitoring System", "email": "alerts@company.com"},
        "recipients": [{"name": "TechOps", "email": "techops@company.com"}],
        "cc": [{"name": "On-Call Engineer", "email": "oncall@company.com"}],
        "body": (
            "ALERT: FIX session gap detected at 14:23:07 UTC.\n\n"
            "Session: SENDER_COMP -> TARGET_COMP\n"
            "Gap: SeqNums 1042 to 1048 missing\n"
            "Action: ResendRequest sent automatically\n\n"
            "Please investigate if trading is impacted."
        ),
        "body_html": None,
        "is_read": True,
        "is_draft": False,
        "has_attachments": False,
        "labels": ["alert", "fix", "high-priority"],
        "sent_at": _now - timedelta(hours=2),
        "created_at": _now - timedelta(hours=2),
    },
    {
        "id": "email-004",
        "subject": "Sprint 24 Planning – Issues for v2.5.0",
        "sender": {"name": "Product Team", "email": "product@company.com"},
        "recipients": [{"name": "Engineering", "email": "engineering@company.com"}],
        "cc": [],
        "body": (
            "Hi all,\n\n"
            "Attached is the sprint 24 plan for v2.5.0 (target: 4 weeks).\n\n"
            "Included issues:\n"
            "- RIQ-500: New user onboarding flow\n"
            "- RIQ-501: Report export improvements\n"
            "- RIQ-502: API rate limiting\n"
            "- RIQ-503: Dark mode support\n\n"
            "Sprint kickoff: Monday 09:00 UTC"
        ),
        "body_html": None,
        "is_read": False,
        "is_draft": False,
        "has_attachments": True,
        "labels": ["sprint", "planning"],
        "sent_at": _now - timedelta(days=1),
        "created_at": _now - timedelta(days=1),
    },
    {
        "id": "email-005",
        "subject": "DRAFT: Release Notes v2.5.0",
        "sender": {"name": "Release Manager", "email": "release@company.com"},
        "recipients": [],
        "cc": [],
        "body": "[DRAFT - not sent]\n\nRelease notes draft for v2.5.0...",
        "body_html": None,
        "is_read": True,
        "is_draft": True,
        "has_attachments": False,
        "labels": ["draft", "release-notes"],
        "sent_at": None,
        "created_at": _now - timedelta(hours=1),
    },
]

_EMAIL_STORE: dict[str, dict] = {e["id"]: e for e in _MOCK_EMAILS}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=EmailList, summary="List emails")
async def list_emails(
    current_user: CurrentUser,
    is_read: Optional[bool] = Query(None),
    is_draft: Optional[bool] = Query(None),
    label: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> EmailList:
    """Return paginated email list with optional filters."""
    emails = list(_EMAIL_STORE.values())

    if is_read is not None:
        emails = [e for e in emails if e["is_read"] == is_read]
    if is_draft is not None:
        emails = [e for e in emails if e["is_draft"] == is_draft]
    if label:
        emails = [e for e in emails if label in e.get("labels", [])]

    emails.sort(key=lambda e: e["created_at"], reverse=True)

    total = len(emails)
    start = (page - 1) * page_size
    end = start + page_size

    return EmailList(
        items=[EmailResponse(**e) for e in emails[start:end]],
        total=total,
    )


@router.get("/{email_id}", response_model=EmailResponse, summary="Get email by ID")
async def get_email(
    email_id: str,
    current_user: CurrentUser,
) -> EmailResponse:
    """Retrieve a single email by ID. Marks it as read."""
    email = _EMAIL_STORE.get(email_id)
    if not email:
        raise HTTPException(status_code=404, detail=f"Email '{email_id}' not found")

    # Mark as read
    email["is_read"] = True
    return EmailResponse(**email)


@router.post(
    "/send",
    response_model=EmailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send an email",
)
async def send_email(
    body: SendEmailRequest,
    current_user: CurrentUser,
) -> EmailResponse:
    """
    Send an email (mock – logs the action without real SMTP).

    For real SMTP, configure SMTP_HOST / SMTP_USERNAME / SMTP_PASSWORD in .env.
    """
    email_id = f"email-{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow()

    email = {
        "id": email_id,
        "subject": body.subject,
        "sender": {"name": current_user.full_name or current_user.email, "email": current_user.email},
        "recipients": [{"name": addr, "email": addr} for addr in body.to],
        "cc": [{"name": addr, "email": addr} for addr in body.cc],
        "body": body.body,
        "body_html": body.body_html,
        "is_read": True,
        "is_draft": False,
        "has_attachments": False,
        "labels": ["sent"],
        "sent_at": now,
        "created_at": now,
    }

    _EMAIL_STORE[email_id] = email
    logger.info("email_sent", email_id=email_id, subject=body.subject, to=body.to)
    return EmailResponse(**email)


@router.post(
    "/draft",
    response_model=DraftResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate an AI email draft",
)
async def generate_draft(
    body: DraftRequest,
    current_user: CurrentUser,
) -> DraftResponse:
    """
    Generate an AI-composed email draft based on context.

    Uses Ollama if available, otherwise returns a structured template.
    """
    from app.services.ai_service import ai_service

    prompt = (
        f"Write a {body.tone} email to {body.recipient} about the following:\n\n"
        f"{body.context}\n\n"
    )
    if body.release_version:
        prompt += f"This relates to release version {body.release_version}.\n"
    if body.issue_ids:
        prompt += f"Reference issues: {', '.join(body.issue_ids)}.\n"
    prompt += (
        "\nReturn ONLY:\n"
        "Subject: <subject line>\n\n"
        "<email body>\n"
    )

    raw = await ai_service._generate_ollama(prompt)

    if raw:
        lines = raw.strip().splitlines()
        subject_line = lines[0] if lines else "Re: Your Request"
        if subject_line.lower().startswith("subject:"):
            subject_line = subject_line[8:].strip()
        body_text = "\n".join(lines[1:]).strip()
    else:
        subject_line = f"Re: {body.context[:60]}..."
        body_text = (
            f"Dear {body.recipient},\n\n"
            f"I am writing to follow up regarding: {body.context}\n\n"
        )
        if body.release_version:
            body_text += f"This pertains to release {body.release_version}.\n\n"
        if body.issue_ids:
            body_text += f"Related issues: {', '.join(body.issue_ids)}\n\n"
        body_text += "Please let me know if you need any further information.\n\nBest regards"

    return DraftResponse(subject=subject_line, body=body_text)

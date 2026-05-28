"""
Chat endpoints with Ollama AI integration and smart mock fallback.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.models.chat import ChatSession, ChatMessage, MessageRole
from app.schemas.chat import (
    ChatMessageRequest,
    ChatMessageResponse,
    ChatTurnResponse,
    ChatSessionResponse,
    ChatSessionList,
)
from app.utils.dependencies import CurrentUser

router = APIRouter(prefix="/chat", tags=["Chat"])
logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Smart mock responses (used when Ollama is unavailable)
# ---------------------------------------------------------------------------

_MOCK_RESPONSES: dict[str, str] = {
    "release": (
        "Based on the release data in ReleaseIQ, here is a summary:\n\n"
        "- **v2.4.0** (Released): Contained 42 issues, 38 fixed. Deployed to 12 clients.\n"
        "- **v2.5.0** (In Progress): Currently in testing phase with 15 open issues.\n"
        "- **v2.6.0** (Planned): Scheduled for next quarter.\n\n"
        "Would you like details on a specific release?"
    ),
    "issue": (
        "Here is the current issue status overview:\n\n"
        "| Status | Count |\n|--------|-------|\n"
        "| Open | 47 |\n| In Progress | 23 |\n| Testing | 12 |\n"
        "| Done | 156 |\n\n"
        "Critical issues: **3** require immediate attention. "
        "Top assignees: Alice (8), Bob (6), Charlie (5)."
    ),
    "bug": (
        "There are currently **3 critical bugs** tracked:\n\n"
        "1. **RIQ-421** – Login timeout not refreshing session (High)\n"
        "2. **RIQ-418** – PDF export missing page breaks (Medium)\n"
        "3. **RIQ-415** – Dashboard chart flickers on resize (Low)\n\n"
        "All are assigned and targeted for v2.5.1."
    ),
    "deploy": (
        "Recent deployment activity:\n\n"
        "- **Production** – v2.4.0 deployed 3 days ago (success, 4m 32s)\n"
        "- **Staging** – v2.5.0-rc1 deployed 6 hours ago (success, 3m 18s)\n"
        "- **Development** – Latest commit deployed 1 hour ago\n\n"
        "No failed deployments in the last 7 days."
    ),
    "client": (
        "Client deployment summary:\n\n"
        "- **Total clients**: 24\n"
        "- **On latest release (v2.4.0)**: 18 (75%)\n"
        "- **On v2.3.x**: 5 clients (scheduled upgrade next week)\n"
        "- **On v2.2.x**: 1 client (legacy contract, Q4 upgrade)\n\n"
        "Acme Corp and TechStart Inc are next in the upgrade queue."
    ),
    "analytics": (
        "ReleaseIQ Analytics Dashboard Summary:\n\n"
        "**This Month:**\n"
        "- 3 releases shipped\n"
        "- 47 issues resolved\n"
        "- Average deployment time: 4m 12s\n"
        "- Release success rate: 94.2%\n\n"
        "**Trend:** Issue resolution rate up 12% vs last month."
    ),
    "help": (
        "I'm the ReleaseIQ AI assistant. I can help you with:\n\n"
        "- **Release information** – status, history, notes\n"
        "- **Issue tracking** – Jira issues, bugs, features\n"
        "- **Deployment status** – environments, timelines\n"
        "- **Client management** – which clients have which version\n"
        "- **Analytics** – trends, metrics, dashboards\n\n"
        "Just ask me anything about your release management!"
    ),
}

_DEFAULT_MOCK = (
    "Thank you for your question. I'm the ReleaseIQ AI assistant. "
    "I can help with releases, issues, deployments, client management, and analytics. "
    "For a full AI experience, please ensure Ollama is running with the configured model. "
    "In the meantime, try asking about 'releases', 'issues', 'deployments', or 'clients'."
)


def _get_datasource_mock_response(message: str) -> str:
    """
    Build a data-driven mock response using DataSourceManager.
    Falls back to keyword-matched templates if no specific data found.
    """
    try:
        from app.services.datasource.manager import get_datasource_manager
        ds = get_datasource_manager()
        lower = message.lower()

        import re

        import json

        # Check for specific JIRA ID references
        jira_ids = re.findall(r"JIRA-\d+", message.upper())
        if jira_ids:
            # Return structured JSON for the first matching JIRA ID so the
            # frontend AIResponseCard can render a rich card.
            for jid in jira_ids:
                issue = ds.get_jira_issue_by_id(jid)
                if issue:
                    # Collect patch-note data
                    fix_version = issue.get('fix_version', '')
                    patch_note = ds.get_patch_note_by_version(fix_version) if fix_version else None
                    release_notes_text = patch_note.get('live_notes', '') if patch_note else ''
                    patch_notes_text = patch_note.get('qa_notes', '') if patch_note else ''

                    # Scan logs for entries referencing this JIRA ID
                    matching_log_lines = []
                    try:
                        for lf in ds.get_logs():
                            for entry in lf.get('entries', []):
                                msg = str(entry.get('message', ''))
                                if jid in msg.upper():
                                    matching_log_lines.append(
                                        f"[{lf.get('filename')}] {entry.get('level','')}: {msg[:200]}"
                                    )
                                    if len(matching_log_lines) >= 3:
                                        break
                            if len(matching_log_lines) >= 3:
                                break
                    except Exception:
                        pass
                    matching_logs_str = '\n'.join(matching_log_lines)

                    # Build root cause from available fields
                    title = issue.get('title', '')
                    module = issue.get('module', '')
                    description = str(issue.get('description', ''))
                    root_cause = (
                        f"Root cause: {title}. Module: {module}. Fix version: {fix_version}."
                        if title else description[:300]
                    )

                    # Workaround: look for "workaround" keyword in description
                    workaround_text = ''
                    if 'workaround' in description.lower():
                        idx = description.lower().index('workaround')
                        workaround_text = description[idx:idx + 300]
                    if not workaround_text:
                        workaround_text = f"Contact support for workaround. Fixed in {fix_version}." if fix_version else "Contact support for workaround."

                    # Determine which sources actually contributed data
                    sources = ['jira']
                    if matching_log_lines:
                        sources.append('logs')
                    if patch_note:
                        sources.append('patch_notes')

                    affected = issue.get('affected_version')
                    payload = {
                        'type': 'jira_detail',
                        'jira_id': jid,
                        'title': title,
                        'status': issue.get('status'),
                        'priority': issue.get('priority'),
                        'created': issue.get('created_date', ''),
                        'assignee': issue.get('assignee', 'Unassigned'),
                        'affected_versions': [affected] if affected else [],
                        'jira_details': description[:400],
                        'release_notes': release_notes_text,
                        'patch_notes': patch_notes_text,
                        'matching_logs': matching_logs_str,
                        'root_cause': root_cause,
                        'workaround': workaround_text,
                        'sources': sources,
                    }
                    return json.dumps(payload)

            # If none of the IDs were found, return a plain-text message
            not_found = ', '.join(jira_ids)
            return f"Issue(s) {not_found} not found in current datasource."

        # Version-specific queries
        versions = re.findall(r"v\d+\.\d+(?:[.-]\w+)?", lower)
        if versions:
            parts = []
            for v in versions:
                releases = ds.get_releases(version=v)
                if releases:
                    r = releases[0]
                    parts.append(
                        f"**Release {r.get('version')}**\n"
                        f"- Status: **{r.get('status')}** | Environment: {r.get('environment')}\n"
                        f"- Health: **{r.get('health')}** | Open Issues: {r.get('open_issues')}\n"
                        f"- Modules: {', '.join(r.get('modules', []))}\n"
                        f"- Owner: {r.get('owner')}\n"
                        f"- Notes: {r.get('notes', '')[:300]}\n"
                    )
                pn = ds.get_patch_note_by_version(v)
                if pn:
                    parts.append(
                        f"**Patch Notes {pn.get('version')}:**\n"
                        f"- JIRA Refs: {', '.join(pn.get('jira_refs', []))}\n"
                        f"- Live changes: {pn.get('live_notes', '')[:300]}\n"
                    )
            if parts:
                return "\n\n".join(parts)

        # Error code query
        if any(kw in lower for kw in ["error", "rejection", "reject", "rms0", "fix-0", "oms-"]):
            error_codes = re.findall(r"[A-Z]{2,5}[- ]?\d{3,4}", message.upper())
            if error_codes:
                parts = []
                for ec_str in error_codes:
                    normalized = ec_str.replace(" ", "").replace("-", "")
                    matches = [e for e in ds.get_error_codes() if e.get("code", "").replace("-", "").upper() == normalized]
                    if matches:
                        e = matches[0]
                        parts.append(
                            f"**Error Code {e.get('code')}** ({e.get('severity')})\n"
                            f"- Module: {e.get('module')}\n"
                            f"- Description: {e.get('description')}\n"
                            f"- Root Cause: {e.get('root_cause', '')}\n"
                            f"- Resolution: {e.get('resolution', '')}\n"
                        )
                if parts:
                    return "\n\n".join(parts)

        # Log / crash query
        if any(kw in lower for kw in ["crash", "log", "exception", "null pointer", "oom", "timeout"]):
            log_findings = []
            for lf in ds.get_logs():
                for entry in lf.get("entries", []):
                    if entry.get("level") in ("ERROR", "FATAL", "CRITICAL"):
                        msg = str(entry.get("message", ""))
                        if any(kw in msg.lower() for kw in lower.split() if len(kw) > 3):
                            log_findings.append(
                                f"[{lf.get('filename')}] [{entry.get('timestamp')}] {entry.get('level')}: {msg[:200]}"
                            )
                            if len(log_findings) >= 3:
                                break
                if len(log_findings) >= 3:
                    break
            if log_findings:
                return (
                    "I found these relevant log entries:\n\n"
                    + "\n\n".join(f"```\n{f}\n```" for f in log_findings)
                )

        # Release/deployment overview
        if any(kw in lower for kw in ["release", "deploy", "version", "live"]):
            releases = ds.get_releases()[:5]
            if releases:
                lines = [f"**Current Release Status:**\n"]
                for r in releases:
                    lines.append(
                        f"- **{r.get('version')}** ({r.get('environment')}): "
                        f"{r.get('status')} | Health: {r.get('health')} | "
                        f"Open: {r.get('open_issues')} issues"
                    )
                return "\n".join(lines)

        # Issues overview
        if any(kw in lower for kw in ["issue", "bug", "jira", "ticket"]):
            issues = ds.get_jira_issues()
            open_count = sum(1 for i in issues if i.get("status", "").lower() in ("open", "in progress"))
            critical_count = sum(1 for i in issues if i.get("priority", "").lower() == "critical")
            by_module: dict = {}
            for i in issues:
                m = i.get("module", "Other")
                by_module[m] = by_module.get(m, 0) + 1
            module_lines = "\n".join(f"  - {m}: {cnt}" for m, cnt in sorted(by_module.items(), key=lambda x: -x[1]))
            return (
                f"**Jira Issue Summary ({len(issues)} total):**\n\n"
                f"- Open/In Progress: **{open_count}**\n"
                f"- Critical Priority: **{critical_count}**\n\n"
                f"**By Module:**\n{module_lines}\n"
            )

        # Client overview
        if any(kw in lower for kw in ["client", "broker", "upgrade"]):
            clients = ds.get_client_releases()
            healthy = sum(1 for c in clients if c.get("health_status", "").lower() == "healthy")
            warning = sum(1 for c in clients if c.get("health_status", "").lower() == "warning")
            critical = sum(1 for c in clients if c.get("health_status", "").lower() == "critical")
            return (
                f"**Client Deployment Summary ({len(clients)} clients):**\n\n"
                f"- Healthy: **{healthy}**\n"
                f"- Warning: **{warning}**\n"
                f"- Critical: **{critical}**\n\n"
                + "\n".join(
                    f"- {c.get('client_name')} ({c.get('client_id')}): "
                    f"{c.get('current_version')} — {c.get('health_status')}"
                    for c in clients[:5]
                )
            )

    except Exception as exc:
        logger.warning(f"Datasource mock response failed: {exc}")

    # Fall back to keyword templates
    lower = message.lower()
    for keyword, response in _MOCK_RESPONSES.items():
        if keyword in lower:
            return response
    return _DEFAULT_MOCK


def _get_mock_response(message: str) -> str:
    """Return a data-driven mock response, with keyword template fallback."""
    return _get_datasource_mock_response(message)


async def _call_ollama(message: str, history: list[dict]) -> Optional[str]:
    """
    Attempt to call Ollama. Returns the response string or None on failure.
    """
    try:
        import httpx
        from app.core.config import settings

        messages = history + [{"role": "user", "content": message}]
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/chat",
                json={"model": settings.AI_MODEL, "messages": messages, "stream": False},
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("message", {}).get("content")
    except Exception as exc:
        logger.warning("ollama_unavailable", error=str(exc))
        return None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_or_create_session(
    db: AsyncSession,
    session_id: Optional[str],
    user_id: Optional[str],
    context_type: Optional[str],
    context_id: Optional[str],
    first_message: str,
) -> ChatSession:
    if session_id:
        result = await db.execute(
            select(ChatSession).where(ChatSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if session:
            return session

    # Create new session
    title = first_message[:80] + ("..." if len(first_message) > 80 else "")
    session = ChatSession(
        id=str(uuid.uuid4()),
        user_id=user_id,
        title=title,
        context_type=context_type,
        context_id=context_id,
    )
    db.add(session)
    await db.flush()
    return session


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/message", response_model=ChatTurnResponse, summary="Send a chat message")
async def send_message(
    body: ChatMessageRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> ChatTurnResponse:
    """
    Process a user message and return an AI response.
    Falls back to smart mock responses when Ollama is unavailable.
    """
    from app.core.config import settings

    session = await _get_or_create_session(
        db=db,
        session_id=body.session_id,
        user_id=current_user.id,
        context_type=body.context_type,
        context_id=body.context_id,
        first_message=body.message,
    )

    # Persist user message
    user_msg = ChatMessage(
        session_id=session.id,
        role=MessageRole.user,
        content=body.message,
    )
    db.add(user_msg)
    await db.flush()

    # Build conversation history for Ollama
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at)
        .limit(20)
    )
    history_messages = history_result.scalars().all()
    ollama_history = [
        {"role": msg.role.value, "content": msg.content}
        for msg in history_messages
        if msg.id != user_msg.id
    ]

    # Build datasource context to augment the prompt
    try:
        from app.services.datasource.manager import get_datasource_manager
        ds_context = get_datasource_manager().build_ai_context(body.message)
    except Exception:
        ds_context = ""

    # If we have context, prepend it to the Ollama system prompt or inject in message
    ollama_message = body.message
    if ds_context:
        ollama_message = (
            f"[SYSTEM CONTEXT FROM RELEASEIQ DATASOURCE]\n{ds_context}\n\n"
            f"[USER QUESTION]\n{body.message}"
        )

    # Try Ollama, fall back to datasource-powered mock
    ai_text = await _call_ollama(ollama_message, ollama_history)
    is_mock = ai_text is None
    if is_mock:
        ai_text = _get_mock_response(body.message)

    # Persist assistant message
    assistant_msg = ChatMessage(
        session_id=session.id,
        role=MessageRole.assistant,
        content=ai_text,
        model_used=settings.AI_MODEL if not is_mock else "mock",
        is_mock=is_mock,
    )
    db.add(assistant_msg)

    # Update session message count
    session.message_count += 2
    db.add(session)
    await db.flush()

    await db.refresh(user_msg)
    await db.refresh(assistant_msg)

    return ChatTurnResponse(
        user_message=ChatMessageResponse.model_validate(user_msg),
        assistant_message=ChatMessageResponse.model_validate(assistant_msg),
        session_id=session.id,
    )


@router.get("/history/{session_id}", response_model=ChatSessionResponse, summary="Get chat history")
async def get_chat_history(
    session_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> ChatSessionResponse:
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id)
    )
    session = result.scalar_one_or_none()

    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Users can only see their own sessions unless admin
    from app.models.user import UserRole
    if session.user_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Load messages
    msg_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
    )
    messages = list(msg_result.scalars().all())

    response = ChatSessionResponse.model_validate(session)
    response.messages = [ChatMessageResponse.model_validate(m) for m in messages]
    return response


@router.get("/sessions", response_model=ChatSessionList, summary="List chat sessions")
async def list_sessions(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> ChatSessionList:
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .limit(50)
    )
    sessions = list(result.scalars().all())

    count_result = await db.execute(
        select(func.count())
        .select_from(ChatSession)
        .where(ChatSession.user_id == current_user.id)
    )
    total = count_result.scalar_one()

    return ChatSessionList(
        items=[ChatSessionResponse.model_validate(s) for s in sessions],
        total=total,
    )


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete chat session")
async def delete_session(
    session_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id)
    )
    session = result.scalar_one_or_none()

    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    from app.models.user import UserRole
    if session.user_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    await db.delete(session)

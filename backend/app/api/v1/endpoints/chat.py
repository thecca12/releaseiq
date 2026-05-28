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
        "I can look up release data for the Greeksoft CTCL products: **Optimus**, **1209**, and **3009**.\n\n"
        "Try asking:\n"
        "- \"Show patch notes for Optimus\"\n"
        "- \"What JIRAs are in the 1209 live patch?\"\n"
        "- \"List recent 3009 releases\""
    ),
    "patch": (
        "Patch notes are available for **Optimus**, **1209**, and **3009** across Live and QA environments.\n\n"
        "Try: \"Show patch notes for Optimus\" or \"What was fixed in the latest 1209 patch?\""
    ),
    "getsctcl": (
        "JIRA issues in this project use the key format **GETSCTCL-XXXXX**.\n\n"
        "Ask me about a specific issue, e.g.: \"What is GETSCTCL-14597?\""
    ),
    "issue": (
        "JIRA issues use the project key **GETSCTCL**.\n\n"
        "Try asking:\n"
        "- \"Tell me about GETSCTCL-14597\"\n"
        "- \"Show open bugs in CTCLClient\"\n"
        "- \"List critical priority issues\""
    ),
    "bug": (
        "Bug reports are tracked under the **GETSCTCL** JIRA project.\n\n"
        "Ask for a specific issue ID (e.g. GETSCTCL-14597) for full details including "
        "description, patch notes, assignee, and matching log entries."
    ),
    "deploy": (
        "Client deployments are tracked per release.\n\n"
        "Try: \"Which clients are on Optimus?\" or \"Show client deployment status\""
    ),
    "client": (
        "Client deployment data is available from the datasource.\n\n"
        "Try: \"Show client release summary\" or \"Which clients need upgrades?\""
    ),
    "flag": (
        "Trading flags come from two config files:\n\n"
        "- **TradingStyle.txt** – Client-side trading behaviour flags\n"
        "- **CTCLManager.ini** – Server-side OMS/RMS configuration\n\n"
        "Ask: \"What does SKIP_RISK_ON_MODIFY do?\" or browse the Flags page."
    ),
    "help": (
        "I'm the ReleaseIQ AI assistant for Greeksoft CTCL. I can help with:\n\n"
        "- **Releases** – Optimus, 1209, 3009 patch notes and status\n"
        "- **JIRA issues** – search GETSCTCL tickets by ID, status, or module\n"
        "- **FIX log analysis** – order lifecycle, anomalies, RCA\n"
        "- **Flags** – TradingStyle.txt and CTCLManager.ini settings\n"
        "- **Error codes** – exchange rejections and OMS/RMS errors\n\n"
        "Ensure Ollama is running for full AI capabilities."
    ),
}

_DEFAULT_MOCK = (
    "I'm the ReleaseIQ AI assistant for **Greeksoft CTCL**.\n\n"
    "I can help with:\n"
    "- **JIRA issues** (GETSCTCL-XXXXX format)\n"
    "- **Patch notes** for Optimus, 1209, 3009\n"
    "- **Flags** (TradingStyle.txt / CTCLManager.ini)\n"
    "- **Error codes**, logs, and exchange circulars\n\n"
    "For full AI responses, ensure Ollama is running."
)


def _get_datasource_mock_response(message: str) -> str:
    """
    Build a data-driven mock response using DataSourceManager.
    Supports any language — extracts entities universally, responds in user's language.
    """
    try:
        from app.services.datasource.manager import get_datasource_manager
        from app.utils.language_utils import (
            detect_language, detect_intent_multilingual,
            extract_jira_ids, extract_versions, extract_error_codes,
        )
        ds = get_datasource_manager()
        lower = message.lower()

        # Detect language for response framing
        lang = detect_language(message)
        intent = detect_intent_multilingual(message)

        import re

        import json

        # Check for specific JIRA ID references (format: GETSCTCL-XXXXX) — language-agnostic
        jira_ids = extract_jira_ids(message)
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

        # Version-specific queries — language-agnostic extraction
        versions = extract_versions(message)
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
                # Try all matching patch notes for this version/release name
                matching_pns = ds.get_patch_notes(version=v)
                for pn in matching_pns[:3]:
                    jira_items = pn.get('jira_items', [])
                    jira_lines = "\n".join(
                        f"  - {j['jira_id']}: {j['summary'][:80]}"
                        for j in jira_items[:10]
                    )
                    parts.append(
                        f"**Patch Notes — {pn.get('version')} ({pn.get('environment')}) "
                        f"{pn.get('release_date','')}**\n"
                        f"- File: {pn.get('filename')}\n"
                        f"- Component: {pn.get('component_type')}\n"
                        f"- JIRA count: {pn.get('jira_count', 0)}\n"
                        + (f"- JIRAs:\n{jira_lines}\n" if jira_lines else "")
                    )
            if parts:
                return "\n\n".join(parts)

        # Error code query
        if any(kw in lower for kw in ["error", "rejection", "reject", "rms0", "fix-0", "oms-", "err_", "error_"]):
            all_error_codes = ds.get_error_codes()

            # Match numeric codes like RMS001, FIX-001
            numeric_codes = re.findall(r"[A-Z]{2,5}[- ]?\d{3,4}", message.upper())
            # Match define-style names like ERR_PRICE_NOT_MULT_TICK_SIZE
            define_names = re.findall(r"\b(ERR_\w+|ERROR_\w+)\b", message.upper())
            # Match plain numeric codes like 16283
            plain_numeric = re.findall(r"\b(\d{4,6})\b", message)

            parts = []
            for ec_str in numeric_codes:
                normalized = ec_str.replace(" ", "").replace("-", "")
                matches = [e for e in all_error_codes if e.get("code", "").replace("-", "").upper() == normalized]
                if matches:
                    e = matches[0]
                    parts.append(
                        f"**Error Code {e.get('code')}** ({e.get('severity')})\n"
                        f"- Module: {e.get('module')}\n"
                        f"- Description: {e.get('description')}\n"
                        f"- Resolution: {e.get('resolution', '')}\n"
                    )
            for name in define_names:
                matches = [e for e in all_error_codes if e.get("code", "").upper() == name]
                if matches:
                    e = matches[0]
                    parts.append(
                        f"**{e.get('code')}** ({e.get('severity')})\n"
                        f"- Description: {e.get('description')}\n"
                        f"- Resolution: {e.get('resolution', '')}\n"
                    )
            for num in plain_numeric:
                matches = [e for e in all_error_codes if str(e.get("code", "")).strip() == num]
                if matches:
                    e = matches[0]
                    parts.append(
                        f"**Error {e.get('code')}** ({e.get('severity')})\n"
                        f"- Description: {e.get('description')}\n"
                        f"- Resolution: {e.get('resolution', '')}\n"
                    )
            if not parts:
                # Fuzzy keyword match across all error codes
                query_words = [w for w in lower.split() if len(w) > 4]
                fuzzy = [
                    e for e in all_error_codes
                    if any(w in e.get("description", "").lower() or w in e.get("code", "").lower()
                           for w in query_words)
                ][:3]
                for e in fuzzy:
                    parts.append(
                        f"**{e.get('code')}** ({e.get('severity')})\n"
                        f"- Description: {e.get('description')}\n"
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
        if intent == "release_query" or any(kw in lower for kw in ["release", "deploy", "version", "live"]):
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

        # Issues overview — filtered first, then generic summary
        if intent == "jira_search" or any(kw in lower for kw in ["issue", "bug", "jira", "ticket", "samasya", "dikkat", "problem"]):
            query_words_j = [w for w in lower.split() if len(w) > 3]
            priority_map = {"critical": "Critical", "high": "High", "medium": "Medium", "low": "Low"}
            matched_priority = next((priority_map[w] for w in query_words_j if w in priority_map), None)

            # Simple keyword search first (most specific)
            keyword_results = [
                i for i in ds.get_jira_issues()
                if any(w in i.get("search_text", "") for w in query_words_j
                       if w not in ("issue", "bugs", "jira", "ticket", "show", "open", "list", "dikhao", "batao"))
            ][:10]

            # Apply priority filter on keyword results if any
            if matched_priority and keyword_results:
                keyword_results = [i for i in keyword_results if i.get("priority") == matched_priority] or keyword_results

            if keyword_results:
                label_parts = []
                if matched_priority:
                    label_parts.append(matched_priority)
                label_parts.append(f"{len(keyword_results)} found")
                lines = [f"**JIRA Issues ({', '.join(label_parts)}):**\n"]
                for i in keyword_results[:8]:
                    lines.append(
                        f"- **{i.get('jira_id')}** [{i.get('priority')}] "
                        f"{i.get('title','')[:70]} | {i.get('status')} "
                        f"| {i.get('assignee') or 'Unassigned'}"
                    )
                return "\n".join(lines)

            # Priority-only filter
            if matched_priority:
                filtered = ds.get_jira_issues(priority=matched_priority)[:10]
                if filtered:
                    lines = [f"**{matched_priority} Priority JIRA Issues ({len(filtered)} found):**\n"]
                    for i in filtered:
                        lines.append(
                            f"- **{i.get('jira_id')}** {i.get('title','')[:70]} "
                            f"| {i.get('status')} | {i.get('assignee') or 'Unassigned'}"
                        )
                    return "\n".join(lines)

            # Generic summary
            issues = ds.get_jira_issues()
            open_count = sum(1 for i in issues if i.get("status", "").lower() in ("open", "in progress"))
            critical_count = sum(1 for i in issues if i.get("priority", "").lower() == "critical")
            by_module: dict = {}
            for i in issues:
                m = i.get("module", "Other")
                by_module[m] = by_module.get(m, 0) + 1
            module_lines = "\n".join(f"  - {m}: {cnt}" for m, cnt in sorted(by_module.items(), key=lambda x: -x[1])[:15])
            return (
                f"**Jira Issue Summary ({len(issues)} total):**\n\n"
                f"- Open/In Progress: **{open_count}**\n"
                f"- Critical Priority: **{critical_count}**\n\n"
                f"**By Module:**\n{module_lines}\n"
            )

        # Client overview
        if intent == "client_query" or any(kw in lower for kw in ["client", "broker", "upgrade", "grahak"]):
            clients = ds.get_client_releases()
            # Check if asking about a specific client by name
            query_words = [w for w in lower.split() if len(w) > 3]
            named = [c for c in clients if any(w in c.get("client_name", "").lower() for w in query_words)]
            if named:
                c = named[0]
                return (
                    f"**Client: {c.get('client_name')} ({c.get('client_id')})**\n\n"
                    f"- Version: **{c.get('current_version')}**\n"
                    f"- Environment: {c.get('environment')}\n"
                    f"- Health: **{c.get('health_status')}**\n"
                    f"- Last Updated: {c.get('last_updated', 'N/A')}\n"
                )
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
                    for c in clients[:10]
                )
            )

        # Test case search — check before flags to avoid "basket" ambiguity
        if any(kw in lower for kw in [
            "test case", "test cases", "testcase", "testing",
            "regression", "smoke test", "test karo", "test dikhao",
        ]):
            query_words_t = [w for w in lower.split() if len(w) > 3]
            all_tests = ds.get_test_cases()
            matched_t = [
                t for t in all_tests
                if any(w in t.get("test_name", "").lower()
                       or w in t.get("module", "").lower()
                       or w in t.get("test_id", "").lower()
                       for w in query_words_t)
            ][:8]
            if matched_t:
                lines = [f"**Test Cases ({len(matched_t)} found):**\n"]
                for t in matched_t:
                    lines.append(
                        f"- **{t.get('test_id')}** [{t.get('module')}]: "
                        f"{t.get('test_name','')[:80]} | Status: {t.get('status','N/A')}"
                    )
                return "\n".join(lines)

        # Flag lookup — specific flag by name or keyword
        if intent == "flag_query" or any(kw in lower for kw in [
            "flag", "kill switch", "trading style", "ini", "tradingstyle",
            "amo", "ioc", "gtd", "mis", "basket", "pre open", "algo",
            "killswitch", "enable", "disable", "setting",
        ]):
            all_flags = ds.get_flags()
            query_words = [w for w in lower.replace("_", " ").split() if len(w) > 2]
            matched = [
                f for f in all_flags
                if any(w in f.get("name", "").lower() or w in f.get("description", "").lower()
                       for w in query_words)
            ][:5]
            if matched:
                lines = [f"**Matching Flags ({len(matched)} found):**\n"]
                for f in matched:
                    lines.append(
                        f"**{f.get('name')}** = `{f.get('value')}`\n"
                        f"  - {f.get('description', '')[:150]}\n"
                        f"  - Source: {f.get('source_file')} | Usage: {f.get('usage', 'N/A')}\n"
                    )
                return "\n".join(lines)

        # Test case search
        if any(kw in lower for kw in [
            "test case", "test cases", "testing", "regression", "smoke test",
            "market watch", "order entry", "basket order", "slice order",
        ]):
            query_words = [w for w in lower.split() if len(w) > 3]
            all_tests = ds.get_test_cases()
            matched = [
                t for t in all_tests
                if any(w in t.get("test_name", "").lower()
                       or w in t.get("module", "").lower()
                       or w in t.get("test_id", "").lower()
                       for w in query_words)
            ][:6]
            if matched:
                lines = [f"**Test Cases ({len(matched)} found):**\n"]
                for t in matched:
                    lines.append(
                        f"- **{t.get('test_id')}** [{t.get('module')}]: "
                        f"{t.get('test_name', '')[:80]} | Status: {t.get('status', 'N/A')}"
                    )
                return "\n".join(lines)

        # Exchange circulars search
        if any(kw in lower for kw in [
            "circular", "nse", "bse", "mcx", "sebi", "exchange", "notification",
            "fix api", "protocol", "nnf", "eti", "ctcl circular",
        ]):
            query_words = [w for w in lower.split() if len(w) > 2]
            circulars = ds.get_circulars()
            matched = [
                c for c in circulars
                if any(w in c.get("subject", "").lower()
                       or w in c.get("body", "").lower()
                       or w in c.get("exchange", "").lower()
                       for w in query_words)
            ][:4]
            if matched:
                lines = [f"**Exchange Circulars ({len(matched)} found):**\n"]
                for c in matched:
                    lines.append(
                        f"**[{c.get('exchange')}] {c.get('subject', c.get('filename', ''))[:80]}**\n"
                        f"  Date: {c.get('date', 'N/A')} | Ref: {c.get('circular_no', 'N/A')}\n"
                        f"  {c.get('body', '')[:200]}\n"
                    )
                return "\n".join(lines)

        # Greek / GreekSoft code lookup
        upper_msg = message.upper()
        code_names_found = re.findall(r'\b(GC_\w+|GRC_\w+|IC_\w+|BC_\w+|EEC_\w+|GIC_\w+)\b', upper_msg)
        if code_names_found or any(kw in lower for kw in [
            "greek code", "gc_", "grc_", "gic_", "ic_", "bc_", "eec_",
            "message type", "broadcast", "token master", "login code",
        ]):
            all_greek = ds.get_greek_codes()
            if code_names_found:
                # Exact + prefix match
                matched_g = [
                    g for g in all_greek
                    if any(g.get("greek_code", "").upper().startswith(cn[:8]) or
                           g.get("greek_code", "").upper() == cn
                           for cn in code_names_found)
                ][:5]
            else:
                query_words_g = [w for w in lower.replace("_", " ").split() if len(w) > 3]
                matched_g = [
                    g for g in all_greek
                    if any(w in g.get("greek_code", "").lower()
                           or w in g.get("description", "").lower()
                           or w in g.get("product_type", "").lower()
                           for w in query_words_g)
                ][:5]
            if matched_g:
                lines = [f"**Greek Codes ({len(matched_g)} found):**\n"]
                for g in matched_g:
                    lines.append(
                        f"**{g.get('greek_code')}** = `{g.get('value')}`\n"
                        f"  - {g.get('description', '')}\n"
                        f"  - Exchange: {g.get('exchange')} | Category: {g.get('product_type')}\n"
                    )
                return "\n".join(lines)

        # Universal fallback — search ALL datasources and format top results
        results = ds.search_all(message)
        if results:
            lines = [f"**Search results for:** _{message[:60]}_\n"]
            seen_types: dict = {}
            for r in results[:8]:
                rtype = r.get("type", "")
                seen_types[rtype] = seen_types.get(rtype, 0) + 1
                if seen_types[rtype] > 3:
                    continue
                title = r.get("title", "")[:80]
                snippet = r.get("snippet", "")[:120]
                source = r.get("source", "")
                lines.append(f"**[{rtype.upper()}]** {title}\n  _{snippet}_\n  Source: {source}\n")
            if len(lines) > 1:
                return "\n".join(lines)

    except Exception as exc:
        logger.warning(f"Datasource mock response failed: {exc}")

    # Fall back to multilingual keyword templates
    try:
        from app.utils.language_utils import detect_intent_multilingual
        intent = detect_intent_multilingual(message)
        intent_to_key = {
            "jira_search": "issue",
            "release_query": "release",
            "error_query": "error",
            "flag_query": "flag",
            "help": "help",
            "client_query": "client",
        }
        key = intent_to_key.get(intent)
        if key and key in _MOCK_RESPONSES:
            return _MOCK_RESPONSES[key]
    except Exception:
        pass

    lower = message.lower()
    for keyword, response in _MOCK_RESPONSES.items():
        if keyword in lower:
            return response
    return _DEFAULT_MOCK


def _get_mock_response(message: str) -> str:
    """Return a data-driven mock response, with keyword template fallback."""
    return _get_datasource_mock_response(message)


async def _call_ai(message: str, history: list[dict], ds_context: str = "") -> Optional[str]:
    """
    Call AI via LiteLLM proxy (primary) → Ollama (fallback).
    Returns assistant response string or None.

    Priority:
      1. LiteLLM proxy  (http://192.168.192.50:4000/v1 — Claude Haiku)
      2. Ollama          (localhost:11434)
      3. None            (caller uses datasource mock response)
    """
    import httpx, json as _json
    from app.core.config import settings

    # Detect language for multilingual response
    try:
        from app.utils.language_utils import detect_language, get_language_instruction
        _lang = detect_language(message)
        _lang_instruction = get_language_instruction(_lang)
    except Exception:
        _lang_instruction = ""

    # Build system prompt enriched with datasource context
    system_content = (
        "You are ReleaseIQ, an expert AI assistant for Greeksoft's CTCL (Client Trading) system "
        "and a knowledgeable assistant for general financial market, trading, and technology topics.\n"
        "Key facts about this system:\n"
        "- JIRA project key: GETSCTCL (e.g. GETSCTCL-14597). Never invent issue IDs.\n"
        "- Products/releases: Optimus, 1209, 3009.\n"
        "- Exchanges: NSE, BSE, MCX, SEBI.\n"
        "- Components: CTCLClient (trading terminal), CTCLServer (OMS/RMS backend).\n"
        "- Config: TradingStyle.txt (client flags), CTCLManager.ini (server flags).\n\n"
        "Instructions:\n"
        "1. If datasource context is provided, use it to give accurate specific answers.\n"
        "2. For general questions (trading concepts, finance, market, technology), answer from your knowledge.\n"
        "3. Never invent JIRA IDs, version numbers, or client names.\n"
        "4. Be concise and use markdown formatting."
        + _lang_instruction + "\n"
    )
    if ds_context:
        system_content += f"\n[DATASOURCE CONTEXT]\n{ds_context}\n"

    system_msg = {"role": "system", "content": system_content}
    messages = [system_msg] + history + [{"role": "user", "content": message}]

    # ── 1. LiteLLM / Claude Haiku proxy ─────────────────────────────────
    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.AI_API_KEY}",
        }
        payload = {
            "model": settings.AI_MODEL,
            "messages": messages,
            "temperature": settings.AI_TEMPERATURE,
            "max_tokens": settings.AI_MAX_TOKENS,
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.AI_BASE_URL}/chat/completions",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            logger.info("litellm_chat_ok",
                        model=data.get("model", settings.AI_MODEL),
                        tokens=data.get("usage", {}).get("total_tokens", 0))
            return content
    except Exception as exc:
        logger.warning("litellm_unavailable", error=str(exc))

    # ── 2. Ollama fallback ────────────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/chat",
                json={"model": "llama3", "messages": messages, "stream": False},
            )
            resp.raise_for_status()
            return resp.json().get("message", {}).get("content")
    except Exception as exc:
        logger.warning("ollama_unavailable", error=str(exc))

    return None


# Keep backward-compatible alias used in the send_message endpoint
async def _call_ollama(message: str, history: list[dict]) -> Optional[str]:
    """Backward-compatible wrapper — delegates to _call_ai."""
    return await _call_ai(message, history)


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

    # Build datasource context for RAG-augmented response
    try:
        from app.services.datasource.manager import get_datasource_manager
        ds_context = get_datasource_manager().build_ai_context(body.message)
    except Exception:
        ds_context = ""

    # Call AI: LiteLLM proxy (Claude Haiku) → Ollama → datasource mock
    ai_text = await _call_ai(body.message, ollama_history, ds_context=ds_context)
    is_mock = ai_text is None
    if is_mock:
        ai_text = _get_mock_response(body.message)

    # Persist assistant message
    assistant_msg = ChatMessage(
        session_id=session.id,
        role=MessageRole.assistant,
        content=ai_text,
        model_used=settings.AI_MODEL if not is_mock else "datasource-mock",
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

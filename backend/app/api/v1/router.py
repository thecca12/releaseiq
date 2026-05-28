"""
API v1 router — assembles all endpoint sub-routers under /api/v1.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    analytics,
    auth,
    backup,
    chat,
    client_releases,
    documents,
    emails,
    indexing,
    issues,
    knowledge,
    logs,
    meetings,
    patch_notes,
    releases,
    search,
    users,
    utilities,
)

api_router = APIRouter(prefix="/api/v1")

# Authentication
api_router.include_router(auth.router)

# Users
api_router.include_router(users.router)

# Core domain resources
api_router.include_router(releases.router)
api_router.include_router(issues.router)

# AI Chat
api_router.include_router(chat.router)

# Logs & Audit
api_router.include_router(logs.router)

# Analytics
api_router.include_router(analytics.router)

# Global search
api_router.include_router(search.router)

# Documents & indexing
api_router.include_router(documents.router)
api_router.include_router(indexing.router)

# Collaboration
api_router.include_router(emails.router)
api_router.include_router(meetings.router)

# Knowledge base
api_router.include_router(knowledge.router)

# Phase 2 datasource endpoints
api_router.include_router(patch_notes.router)
api_router.include_router(utilities.router)
api_router.include_router(client_releases.router)

# Backup
api_router.include_router(backup.router)

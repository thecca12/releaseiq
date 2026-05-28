"""
Seed script: creates default users and sample data on first startup.
Run directly: python -m app.utils.seed_data
Or called from app startup event.
"""

import asyncio
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, init_db
from app.core.logging import get_logger
from app.core.security import hash_password
from app.models.issue import IssuePriority, IssueStatus, IssueType, JiraIssue
from app.models.release import ClientRelease, DeploymentHistory, Release, ReleaseStatus
from app.models.user import User, UserRole

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

DEFAULT_USERS = [
    {
        "username": "admin",
        "email": "admin@releaseiq.com",
        "full_name": "System Administrator",
        "password": "admin123",
        "role": UserRole.admin,
    },
    {
        "username": "manager1",
        "email": "manager1@releaseiq.com",
        "full_name": "Alice Johnson",
        "password": "manager123",
        "role": UserRole.manager,
    },
    {
        "username": "user1",
        "email": "user1@releaseiq.com",
        "full_name": "Bob Smith",
        "password": "user123",
        "role": UserRole.user,
    },
]


async def seed_users(db: AsyncSession) -> dict[str, User]:
    """Create default users if they don't exist. Returns username→User map."""
    users: dict[str, User] = {}

    for data in DEFAULT_USERS:
        result = await db.execute(select(User).where(User.username == data["username"]))
        user = result.scalar_one_or_none()

        if user is None:
            user = User(
                email=data["email"],
                username=data["username"],
                full_name=data["full_name"],
                hashed_password=hash_password(data["password"]),
                role=data["role"],
                is_active=True,
            )
            db.add(user)
            await db.flush()
            logger.info("seed_user_created", username=data["username"], role=data["role"])

        users[data["username"]] = user

    return users


# ---------------------------------------------------------------------------
# Releases
# ---------------------------------------------------------------------------

SAMPLE_RELEASES = [
    {
        "version": "2.3.1",
        "name": "Hotfix Release 2.3.1",
        "description": "Critical bug fixes for production issues",
        "status": ReleaseStatus.released,
        "planned_date": datetime(2024, 3, 10, tzinfo=timezone.utc),
        "release_date": datetime(2024, 3, 12, tzinfo=timezone.utc),
        "release_notes": "## Hotfix 2.3.1\n- Fixed critical login session issue\n- Performance improvements",
        "jira_project_key": "RIQ",
        "issue_count": 8,
        "fixed_issue_count": 8,
        "tags": ["hotfix", "critical"],
    },
    {
        "version": "2.4.0",
        "name": "Summer Release 2024",
        "description": "Major feature update with performance improvements and new analytics module",
        "status": ReleaseStatus.released,
        "planned_date": datetime(2024, 6, 1, tzinfo=timezone.utc),
        "release_date": datetime(2024, 6, 15, tzinfo=timezone.utc),
        "release_notes": "## What's New in 2.4.0\n\n### Features\n- New analytics dashboard\n- Improved release timeline\n- Bulk operations support\n\n### Bug Fixes\n- Fixed PDF export issues\n- Resolved WebSocket connection drops",
        "jira_project_key": "RIQ",
        "issue_count": 42,
        "fixed_issue_count": 42,
        "tags": ["feature", "analytics", "performance"],
    },
    {
        "version": "2.5.0",
        "name": "Autumn Release 2024",
        "description": "AI assistant integration and enhanced reporting features",
        "status": ReleaseStatus.testing,
        "planned_date": datetime(2024, 9, 1, tzinfo=timezone.utc),
        "release_date": None,
        "release_notes": None,
        "jira_project_key": "RIQ",
        "issue_count": 28,
        "fixed_issue_count": 15,
        "tags": ["ai", "reporting", "enterprise"],
    },
    {
        "version": "2.6.0",
        "name": "Winter Release 2024",
        "description": "Enterprise features, SSO integration, and scalability improvements",
        "status": ReleaseStatus.planned,
        "planned_date": datetime(2024, 12, 1, tzinfo=timezone.utc),
        "release_date": None,
        "release_notes": None,
        "jira_project_key": "RIQ",
        "issue_count": 0,
        "fixed_issue_count": 0,
        "tags": ["enterprise", "sso", "scalability"],
    },
]


async def seed_releases(db: AsyncSession, admin_user: User) -> list[Release]:
    """Create sample releases if they don't exist."""
    releases = []

    for data in SAMPLE_RELEASES:
        result = await db.execute(select(Release).where(Release.version == data["version"]))
        release = result.scalar_one_or_none()

        if release is None:
            release = Release(**data, created_by=admin_user.username)
            db.add(release)
            await db.flush()
            logger.info("seed_release_created", version=data["version"])

        releases.append(release)

    return releases


# ---------------------------------------------------------------------------
# Client Releases
# ---------------------------------------------------------------------------

SAMPLE_CLIENTS = [
    ("client-001", "Acme Corporation"),
    ("client-002", "TechStart Inc"),
    ("client-003", "Global Systems Ltd"),
    ("client-004", "DataFlow Technologies"),
    ("client-005", "InnovateTech Group"),
]


async def seed_client_releases(db: AsyncSession, releases: list[Release]) -> None:
    """Assign clients to the released version."""
    released = [r for r in releases if r.status == ReleaseStatus.released]
    if not released:
        return

    latest_release = released[-1]

    for client_id, client_name in SAMPLE_CLIENTS:
        result = await db.execute(
            select(ClientRelease).where(
                ClientRelease.release_id == latest_release.id,
                ClientRelease.client_id == client_id,
            )
        )
        if result.scalar_one_or_none() is None:
            cr = ClientRelease(
                release_id=latest_release.id,
                client_id=client_id,
                client_name=client_name,
                environment="production",
                is_deployed=True,
                deployed_at=latest_release.release_date or datetime.now(timezone.utc),
            )
            db.add(cr)

    await db.flush()
    logger.info("seed_client_releases_created", release_version=latest_release.version)


# ---------------------------------------------------------------------------
# Deployment History
# ---------------------------------------------------------------------------

async def seed_deployment_history(db: AsyncSession, releases: list[Release], admin_user: User) -> None:
    """Create sample deployment history."""
    for release in releases:
        if release.status not in (ReleaseStatus.released, ReleaseStatus.testing):
            continue

        for env in ["development", "staging", "production"]:
            result = await db.execute(
                select(DeploymentHistory).where(
                    DeploymentHistory.release_id == release.id,
                    DeploymentHistory.environment == env,
                )
            )
            if result.scalar_one_or_none() is None:
                started = release.release_date or datetime.now(timezone.utc)
                completed = started + timedelta(seconds=252)
                dep = DeploymentHistory(
                    release_id=release.id,
                    environment=env,
                    status="success",
                    deployed_by=admin_user.username,
                    started_at=started,
                    completed_at=completed,
                    duration_seconds=252,
                    commit_sha="a1b2c3d4e5f67890abcdef1234567890abcdef12",
                    pipeline_url="https://ci.example.com/pipelines/42",
                )
                db.add(dep)

    await db.flush()
    logger.info("seed_deployment_history_created")


# ---------------------------------------------------------------------------
# Issues
# ---------------------------------------------------------------------------

SAMPLE_ISSUES = [
    ("RIQ-415", "Memory leak in WebSocket handler", IssueType.bug, IssueStatus.open, IssuePriority.critical, "Bob Smith"),
    ("RIQ-416", "Bulk import releases from CSV", IssueType.feature, IssueStatus.open, IssuePriority.high, "Bob Smith"),
    ("RIQ-417", "Improve release timeline view", IssueType.improvement, IssueStatus.in_progress, IssuePriority.medium, "Alice Johnson"),
    ("RIQ-418", "Dashboard chart flickers on resize", IssueType.bug, IssueStatus.testing, IssuePriority.medium, "Bob Smith"),
    ("RIQ-419", "Add dark mode support", IssueType.feature, IssueStatus.open, IssuePriority.low, None),
    ("RIQ-420", "PDF export missing page breaks", IssueType.bug, IssueStatus.open, IssuePriority.medium, "Alice Johnson"),
    ("RIQ-421", "Login timeout not refreshing session", IssueType.bug, IssueStatus.in_progress, IssuePriority.high, "Alice Johnson"),
    ("RIQ-422", "API rate limiting for external integrations", IssueType.task, IssueStatus.done, IssuePriority.medium, "Bob Smith"),
    ("RIQ-423", "Automated regression test suite", IssueType.story, IssueStatus.in_progress, IssuePriority.high, "Bob Smith"),
    ("RIQ-424", "SSO integration with Azure AD", IssueType.feature, IssueStatus.open, IssuePriority.high, None),
]


async def seed_issues(db: AsyncSession, releases: list[Release]) -> None:
    """Create sample Jira issues."""
    testing_release = next((r for r in releases if r.status == ReleaseStatus.testing), None)

    for jira_key, summary, itype, istatus, priority, assignee in SAMPLE_ISSUES:
        result = await db.execute(select(JiraIssue).where(JiraIssue.jira_key == jira_key))
        if result.scalar_one_or_none() is not None:
            continue

        issue = JiraIssue(
            jira_key=jira_key,
            jira_id=jira_key.split("-")[1],
            project_key="RIQ",
            project_name="ReleaseIQ",
            summary=summary,
            description=f"Detailed description for {jira_key}. This issue tracks: {summary}",
            issue_type=itype,
            status=istatus,
            priority=priority,
            reporter="admin",
            assignee=assignee,
            fix_version=testing_release.version if testing_release else "2.5.0",
            release_id=testing_release.id if testing_release and istatus != IssueStatus.done else None,
            labels=["backend"] if "API" in summary or "memory" in summary.lower() else ["frontend"],
            components=["core"],
            story_points=(len(jira_key) % 8) + 1,
            jira_url=f"https://jira.example.com/browse/{jira_key}",
            resolved_at=datetime.now(timezone.utc) if istatus == IssueStatus.done else None,
        )
        db.add(issue)

    await db.flush()
    logger.info("seed_issues_created")


# ---------------------------------------------------------------------------
# Main seed runner
# ---------------------------------------------------------------------------

async def run_seed(db: AsyncSession) -> None:
    """Run all seed operations in a single transaction."""
    logger.info("seed_starting")

    users = await seed_users(db)
    admin = users.get("admin")
    if admin is None:
        logger.error("seed_failed", reason="admin user not found after seed")
        return

    releases = await seed_releases(db, admin)
    await seed_client_releases(db, releases)
    await seed_deployment_history(db, releases, admin)
    await seed_issues(db, releases)

    await db.commit()
    logger.info("seed_completed")


async def seed_if_empty(db: AsyncSession) -> None:
    """Only seed if the database appears empty (no users)."""
    result = await db.execute(select(User).limit(1))
    if result.scalar_one_or_none() is None:
        await run_seed(db)
    else:
        logger.info("seed_skipped", reason="database already has data")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

async def main() -> None:
    from app.core.logging import configure_logging
    configure_logging()

    logger.info("initializing_database")
    await init_db()

    async with AsyncSessionLocal() as db:
        await run_seed(db)


if __name__ == "__main__":
    asyncio.run(main())

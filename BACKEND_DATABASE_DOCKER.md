# ReleaseIQ — Backend, Database & Docker Complete Reference

---

## PART 1 — DATABASE

### 1.1 Overview

| Setting | Development | Production |
|---------|-------------|------------|
| Engine | SQLite (file-based) | PostgreSQL 16 |
| Driver | `aiosqlite` (async) | `asyncpg` (async) |
| File | `backend/releaseiq.db` | Docker volume `postgres_data` |
| ORM | SQLAlchemy 2.0 async | SQLAlchemy 2.0 async |
| Migrations | Alembic | Alembic |
| Auto-seed | Yes (on first startup) | Yes (on first startup) |

---

### 1.2 Connection Setup (`app/core/database.py`)

```python
# URL auto-conversion:
# sqlite:///./releaseiq.db  → sqlite+aiosqlite:///./releaseiq.db
# postgresql://...          → postgresql+asyncpg://...

# SQLite engine settings:
connect_args = {"check_same_thread": False}

# PostgreSQL engine settings:
pool_size = 10
max_overflow = 20
pool_pre_ping = True

# Session factory (async):
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,   # avoids lazy-load errors after commit
    autoflush=False,
    autocommit=False,
)

# FastAPI dependency pattern:
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()    # auto-commit on success
        except Exception:
            await session.rollback()  # auto-rollback on error
            raise
        finally:
            await session.close()
```

---

### 1.3 Complete Database Schema

#### Table 1: `users`
Primary table for authentication and authorization.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | VARCHAR(36) | PK | UUID v4 |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL, INDEX | User email |
| `username` | VARCHAR(100) | UNIQUE, NOT NULL, INDEX | Login username |
| `full_name` | VARCHAR(255) | NOT NULL | Display name |
| `hashed_password` | VARCHAR(255) | NOT NULL | bcrypt hash |
| `role` | ENUM | NOT NULL | `admin` / `manager` / `user` |
| `is_active` | BOOLEAN | NOT NULL, default=True | Account status |
| `created_at` | DATETIME(tz) | NOT NULL | UTC timestamp |
| `updated_at` | DATETIME(tz) | NOT NULL | Auto-updated |
| `last_login` | DATETIME(tz) | nullable | Last login UTC |

**Relationships:**
- `audit_logs` → one-to-many → `AuditLog` (cascade delete)
- `chat_sessions` → one-to-many → `ChatSession` (cascade delete)

**Seeded Users:**
```
admin     | admin@releaseiq.com    | role=admin   | password=admin123
manager1  | manager1@releaseiq.com | role=manager | password=manager123
user1     | user1@releaseiq.com    | role=user    | password=user123
```

---

#### Table 2: `audit_logs`
Tracks every user action for compliance and security.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | VARCHAR(36) | PK | UUID v4 |
| `user_id` | VARCHAR(36) | FK→users(SET NULL), INDEX | Who did it |
| `action` | VARCHAR(100) | NOT NULL | Action name (e.g. `user.login`) |
| `resource_type` | VARCHAR(100) | nullable | What was acted on |
| `resource_id` | VARCHAR(36) | nullable | ID of the resource |
| `detail` | TEXT | nullable | JSON or text details |
| `ip_address` | VARCHAR(45) | nullable | IPv4/IPv6 |
| `created_at` | DATETIME(tz) | NOT NULL | UTC timestamp |

---

#### Table 3: `releases`
Core release management records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | VARCHAR(36) | PK | UUID v4 |
| `version` | VARCHAR(50) | NOT NULL, INDEX | e.g. `2.4.0` |
| `name` | VARCHAR(255) | NOT NULL | Human name |
| `description` | TEXT | nullable | Summary |
| `status` | ENUM | NOT NULL, INDEX | See statuses below |
| `planned_date` | DATETIME(tz) | nullable | Target date |
| `release_date` | DATETIME(tz) | nullable | Actual release date |
| `release_notes` | TEXT | nullable | Markdown notes |
| `created_by` | VARCHAR(255) | nullable | Username |
| `approved_by` | VARCHAR(255) | nullable | Approver username |
| `jira_project_key` | VARCHAR(50) | nullable | e.g. `RIQ` |
| `issue_count` | INTEGER | NOT NULL, default=0 | Total issues |
| `fixed_issue_count` | INTEGER | NOT NULL, default=0 | Fixed issues |
| `tags` | JSON | nullable | `["hotfix","critical"]` |
| `created_at` | DATETIME(tz) | NOT NULL | |
| `updated_at` | DATETIME(tz) | NOT NULL | Auto-updated |

**Status Enum (`ReleaseStatus`):**
```
planned → in_progress → testing → staging → released
                                           ↘ rolled_back
                                           ↘ cancelled
```

**Relationships:**
- `client_releases` → one-to-many → `ClientRelease` (cascade delete)
- `deployments` → one-to-many → `DeploymentHistory` (cascade delete)

**Seeded Releases:**
```
v2.3.1  Hotfix Release 2.3.1     status=released  date=2024-03-12
v2.4.0  Summer Release 2024      status=released  date=2024-06-15
v2.5.0  Autumn Release 2024      status=testing   (in QA)
v2.6.0  Winter Release 2024      status=planned   (future)
```

---

#### Table 4: `client_releases`
Maps which clients have which release deployed.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | VARCHAR(36) | PK | UUID v4 |
| `release_id` | VARCHAR(36) | FK→releases(CASCADE), INDEX | Parent release |
| `client_id` | VARCHAR(100) | NOT NULL, INDEX | Client identifier |
| `client_name` | VARCHAR(255) | NOT NULL | Display name |
| `environment` | VARCHAR(50) | NOT NULL, default=production | Deployment env |
| `deployed_at` | DATETIME(tz) | nullable | When deployed |
| `is_deployed` | BOOLEAN | NOT NULL, default=False | Deployed flag |
| `deployment_notes` | TEXT | nullable | Notes |
| `created_at` | DATETIME(tz) | NOT NULL | |

**Seeded Client Releases (all on v2.4.0 production):**
```
client-001  Acme Corporation      production  deployed=True  2024-06-15
client-002  TechStart Inc         production  deployed=True  2024-06-15
client-003  Global Systems Ltd    production  deployed=True  2024-06-15
client-004  DataFlow Technologies production  deployed=True  2024-06-15
client-005  InnovateTech Group    production  deployed=True  2024-06-15
```

---

#### Table 5: `deployment_history`
Full audit trail of every deployment event.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | VARCHAR(36) | PK | UUID v4 |
| `release_id` | VARCHAR(36) | FK→releases(CASCADE), INDEX | Release deployed |
| `environment` | VARCHAR(50) | NOT NULL | development/staging/production |
| `status` | VARCHAR(50) | NOT NULL, default=pending | pending/running/success/failed/rolled_back |
| `deployed_by` | VARCHAR(255) | nullable | Username |
| `started_at` | DATETIME(tz) | NOT NULL | |
| `completed_at` | DATETIME(tz) | nullable | |
| `duration_seconds` | INTEGER | nullable | How long it took |
| `log_output` | TEXT | nullable | Deployment logs |
| `error_message` | TEXT | nullable | Error if failed |
| `commit_sha` | VARCHAR(40) | nullable | Git commit |
| `pipeline_url` | VARCHAR(500) | nullable | CI/CD link |

**Seeded:** 9 deployment records (v2.3.1 + v2.4.0 each in dev/staging/production, v2.5.0 in dev/staging/production)

---

#### Table 6: `jira_issues`
Issue tracking records (manual or JIRA-imported).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | VARCHAR(36) | PK | UUID v4 |
| `jira_key` | VARCHAR(50) | UNIQUE, NOT NULL, INDEX | e.g. `RIQ-415` |
| `jira_id` | VARCHAR(50) | nullable | JIRA internal ID |
| `project_key` | VARCHAR(50) | NOT NULL, INDEX | e.g. `RIQ` |
| `project_name` | VARCHAR(255) | nullable | |
| `summary` | VARCHAR(500) | NOT NULL | Issue title |
| `description` | TEXT | nullable | Full description |
| `issue_type` | ENUM | NOT NULL, INDEX | bug/feature/improvement/task/story/epic/sub_task |
| `status` | ENUM | NOT NULL, INDEX | open/in_progress/in_review/testing/done/closed/wont_fix |
| `priority` | ENUM | NOT NULL, INDEX | critical/high/medium/low/trivial |
| `reporter` | VARCHAR(255) | nullable | Who reported |
| `assignee` | VARCHAR(255) | nullable | Who is assigned |
| `created_at` | DATETIME(tz) | NOT NULL | |
| `updated_at` | DATETIME(tz) | NOT NULL | |
| `resolved_at` | DATETIME(tz) | nullable | When closed |
| `due_date` | DATETIME(tz) | nullable | |
| `release_id` | VARCHAR(36) | FK→releases(SET NULL), INDEX | Target release |
| `fix_version` | VARCHAR(50) | nullable | Version to fix in |
| `affects_versions` | JSON | nullable | `["2.3.1","2.4.0"]` |
| `labels` | JSON | nullable | `["backend","api"]` |
| `components` | JSON | nullable | `["core"]` |
| `story_points` | INTEGER | nullable | |
| `time_estimate` | INTEGER | nullable | Seconds |
| `time_spent` | INTEGER | nullable | Seconds |
| `custom_fields` | JSON | nullable | JIRA custom fields |
| `jira_url` | VARCHAR(500) | nullable | Link to JIRA |

**Seeded Issues (10 records):**
```
RIQ-415  Memory leak in WebSocket handler        open        critical
RIQ-416  Bulk import releases from CSV           open        high
RIQ-417  Improve release timeline view           in_progress medium
RIQ-418  Dashboard chart flickers on resize      testing     medium
RIQ-419  Add dark mode support                   open        low
RIQ-420  PDF export missing page breaks          open        medium
RIQ-421  Login timeout not refreshing session    in_progress high
RIQ-422  API rate limiting                       done        medium
RIQ-423  Automated regression test suite         in_progress high
RIQ-424  SSO integration with Azure AD           open        high
```

---

#### Table 7: `documents`
Knowledge base document storage and indexing.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | VARCHAR(36) | PK | UUID v4 |
| `filename` | VARCHAR(500) | NOT NULL | Stored filename |
| `original_filename` | VARCHAR(500) | NOT NULL | Original upload name |
| `content_type` | VARCHAR(100) | NOT NULL | MIME type |
| `file_size` | BIGINT | NOT NULL | Bytes |
| `file_path` | VARCHAR(1000) | NOT NULL | Storage path |
| `status` | ENUM | NOT NULL, INDEX | pending/processing/indexed/failed/deleted |
| `extracted_text` | TEXT | nullable | Full text content |
| `chunk_count` | INTEGER | NOT NULL, default=0 | Vector chunks |
| `chroma_collection` | VARCHAR(255) | nullable | ChromaDB collection |
| `title` | VARCHAR(500) | nullable | Document title |
| `description` | TEXT | nullable | |
| `tags` | TEXT | nullable | Comma-separated |
| `uploaded_by` | VARCHAR(36) | FK→users(SET NULL) | Who uploaded |
| `is_public` | BOOLEAN | NOT NULL, default=True | Access control |
| `created_at` | DATETIME(tz) | NOT NULL | |
| `updated_at` | DATETIME(tz) | NOT NULL | |
| `indexed_at` | DATETIME(tz) | nullable | When indexed |

**Relationships:**
- `indexing_jobs` → one-to-many → `IndexingJob` (cascade delete)

---

#### Table 8: `indexing_jobs`
Background job tracker for document indexing.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | VARCHAR(36) | PK | UUID v4 |
| `document_id` | VARCHAR(36) | FK→documents(CASCADE), INDEX | Parent document |
| `status` | ENUM | NOT NULL, INDEX | queued/running/completed/failed/cancelled |
| `celery_task_id` | VARCHAR(255) | nullable | Celery task ID |
| `error_message` | TEXT | nullable | Error details |
| `chunks_created` | INTEGER | NOT NULL, default=0 | Chunks stored |
| `started_at` | DATETIME(tz) | nullable | |
| `completed_at` | DATETIME(tz) | nullable | |
| `created_at` | DATETIME(tz) | NOT NULL | |

---

#### Table 9: `chat_sessions`
Groups chat messages into conversations per user.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | VARCHAR(36) | PK | UUID v4 |
| `user_id` | VARCHAR(36) | FK→users(CASCADE), INDEX | Owner |
| `title` | VARCHAR(500) | NOT NULL, default="New Chat" | Session title |
| `is_active` | BOOLEAN | NOT NULL, default=True | |
| `message_count` | INTEGER | NOT NULL, default=0 | Counter |
| `context_type` | VARCHAR(50) | nullable | `release`/`issue`/`general` |
| `context_id` | VARCHAR(36) | nullable | Related entity ID |
| `created_at` | DATETIME(tz) | NOT NULL | |
| `updated_at` | DATETIME(tz) | NOT NULL | |

**Relationships:**
- `messages` → one-to-many → `ChatMessage` (cascade delete, ordered by `created_at`)

---

#### Table 10: `chat_messages`
Individual AI conversation messages.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | VARCHAR(36) | PK | UUID v4 |
| `session_id` | VARCHAR(36) | FK→chat_sessions(CASCADE), INDEX | Parent session |
| `role` | ENUM | NOT NULL | `user` / `assistant` / `system` |
| `content` | TEXT | NOT NULL | Message text |
| `model_used` | VARCHAR(100) | nullable | e.g. `llama3` |
| `tokens_used` | INTEGER | nullable | Token count |
| `sources` | JSON | nullable | `[{type,reference,snippet}]` |
| `is_mock` | BOOLEAN | NOT NULL, default=False | Was AI or mock |
| `created_at` | DATETIME(tz) | NOT NULL | |

---

### 1.4 Entity Relationship Diagram (ERD)

```
users ──────────────────────────────────────────────────────────
  │ 1:N                                                         │
  ├──→ audit_logs (user_id FK, SET NULL on delete)             │
  ├──→ chat_sessions (user_id FK, CASCADE delete)              │
  │      └──→ chat_messages (session_id FK, CASCADE delete)    │
  └──→ documents (uploaded_by FK, SET NULL on delete)          │
         └──→ indexing_jobs (document_id FK, CASCADE delete)   │
                                                                │
releases ───────────────────────────────────────────────────── │
  │ 1:N                                                         │
  ├──→ client_releases (release_id FK, CASCADE delete)         │
  ├──→ deployment_history (release_id FK, CASCADE delete)      │
  └──→ jira_issues (release_id FK, SET NULL on delete)  ───────┘
```

---

### 1.5 Seed Data Summary

Runs automatically on first startup if `users` table is empty:

```python
# Trigger: app/main.py lifespan → seed_if_empty(db)
# File:    app/utils/seed_data.py → run_seed()

# Order of operations:
1. seed_users()              → creates admin, manager1, user1
2. seed_releases(admin)      → creates 4 releases (v2.3.1 → v2.6.0)
3. seed_client_releases()    → 5 clients on v2.4.0 production
4. seed_deployment_history() → 9 deployment events
5. seed_issues()             → 10 JIRA issues linked to v2.5.0
```

To **reset and re-seed:**
```bash
cd backend
rm releaseiq.db
python3 run.py       # auto-seeds on startup
```

To **run seed manually** (without restarting):
```bash
cd backend
python3 -m app.utils.seed_data
```

---

### 1.6 Database Configuration Options

```bash
# backend/.env

# SQLite (development — default)
DATABASE_URL=sqlite:///./releaseiq.db

# SQLite (absolute path)
DATABASE_URL=sqlite:////home/force/mydata/releaseiq.db

# PostgreSQL (production)
DATABASE_URL=postgresql://user:password@localhost:5432/releaseiq
# Note: driver prefix auto-converted to postgresql+asyncpg

# PostgreSQL (with SSL)
DATABASE_URL=postgresql://user:pass@host:5432/releaseiq?sslmode=require
```

---

### 1.7 Alembic Migrations

For evolving the schema (adding columns, tables) without losing data:

```bash
cd backend

# Create a new migration after changing models:
alembic revision --autogenerate -m "add_new_column_to_users"

# Apply all pending migrations:
alembic upgrade head

# Rollback one migration:
alembic downgrade -1

# Show migration history:
alembic history

# Show current version:
alembic current
```

**`alembic.ini`** → points to `./alembic/` directory  
**`alembic/env.py`** → reads `settings.DATABASE_URL`, imports all models automatically

---

### 1.8 Querying the Database Directly

```bash
# SQLite (development)
cd backend
python3 -c "
import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def run():
    async with AsyncSessionLocal() as db:
        result = await db.execute(text('SELECT * FROM users'))
        for row in result.fetchall():
            print(row)

asyncio.run(run())
"

# Or use sqlite3 CLI:
sqlite3 releaseiq.db '.tables'
sqlite3 releaseiq.db 'SELECT username, role FROM users;'
```

---

## PART 2 — BACKEND SERVICES

### 2.1 Application Entry Point (`app/main.py`)

```
FastAPI App Factory
│
├── CORS Middleware
│   └── Origins: http://localhost:3000,5173 (from ALLOWED_ORIGINS)
│
├── AuthMiddleware (JWT validation)
│   └── Public paths (no auth needed):
│       /, /health, /docs, /redoc, /openapi.json
│       /api/v1/auth/login, /api/v1/auth/refresh
│       /docs/*, /redoc/*, /openapi/*, /static/*
│
├── Lifespan Events
│   ├── Startup: configure_logging() → init_db() → seed_if_empty()
│   └── Shutdown: logs shutdown event
│
├── Routers
│   └── /api/v1/* (14 endpoint modules)
│
├── WebSocket
│   └── /ws/chat/{client_id}  (streaming AI chat)
│
└── Error Handlers
    ├── 404 → {"detail": "Not Found", "path": "..."}
    ├── 405 → {"detail": "Method Not Allowed"}
    ├── 422 → {"detail": "Validation Error", "errors": [...]}
    └── 500 → {"detail": "Internal Server Error"}
```

---

### 2.2 JWT Authentication Flow

```
LOGIN FLOW:
Client → POST /api/v1/auth/login {username, password}
       ↓
AuthService.authenticate_user() → verify bcrypt password
       ↓
create_token_pair(user_id, email, role)
  → access_token  (expires: 60 min, type="access")
  → refresh_token (expires: 7 days, type="refresh")
       ↓
Return: {access_token, refresh_token, token_type="bearer", expires_in=3600, user: {...}}

─────────────────────────────────────────────────

PROTECTED REQUEST FLOW:
Client → GET /api/v1/releases
         Authorization: Bearer eyJhbGci...
       ↓
AuthMiddleware.dispatch()
  → extract_bearer_token() → verify_access_token() → TokenPayload
  → request.state.token_payload = payload
       ↓
get_current_user() dependency
  → reads request.state.token_payload
  → UserService.get_by_id(payload.sub)
  → checks user.is_active
  → returns User object
       ↓
Endpoint receives: current_user: CurrentUser

─────────────────────────────────────────────────

TOKEN PAYLOAD STRUCTURE:
{
  "sub": "e2390c93-c334-4337-ac34-a60aa1cae848",  # user UUID
  "email": "admin@releaseiq.com",
  "role": "admin",
  "type": "access",                                 # or "refresh"
  "iat": 1748411135,                               # issued-at Unix timestamp
  "exp": 1748414735                                # expiry Unix timestamp
}
```

---

### 2.3 Role-Based Access Control

```python
# Usage in endpoints:
from app.utils.dependencies import CurrentUser, AdminUser, ManagerUser

# Any logged-in user:
@router.get("/releases")
async def list_releases(current_user: CurrentUser, db: ...):
    ...

# Admin only (raises 403 for manager/user):
@router.post("/users")
async def create_user(_: AdminUser, db: ...):
    ...

# Admin or Manager (raises 403 for user):
@router.post("/releases/{id}/approve")
async def approve(_: ManagerUser, db: ...):
    ...
```

---

### 2.4 API Endpoints Reference

All endpoints require `Authorization: Bearer <token>` unless marked public.

#### Auth (`/api/v1/auth/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | Public | Login → tokens + user |
| GET | `/auth/me` | Any | Current user profile |
| POST | `/auth/logout` | Any | Invalidate session |
| POST | `/auth/refresh` | Public | Refresh access token |
| POST | `/auth/change-password` | Any | Change own password |

#### Users (`/api/v1/users/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users` | Admin | List all users (paginated) |
| POST | `/users` | Admin | Create new user |
| GET | `/users/{id}` | Admin | Get user by ID |
| PUT | `/users/{id}` | Admin | Update user |
| DELETE | `/users/{id}` | Admin | Delete user |
| POST | `/users/{id}/reset-password` | Admin | Reset to random password |
| POST | `/users/{id}/toggle-active` | Admin | Activate / deactivate |

#### Analytics (`/api/v1/analytics/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/analytics/dashboard` | Any | Dashboard KPIs |
| GET | `/analytics/releases/trend` | Any | Monthly release trend |
| GET | `/analytics/issues/by-status` | Any | Issue counts by status |
| GET | `/analytics/issues/by-priority` | Any | Issue counts by priority |
| GET | `/analytics/velocity` | Any | Sprint velocity chart data |
| GET | `/analytics/log-errors` | Any | Error rate by module |
| GET | `/analytics/deployment-success-rate` | Any | Deployment success % |

#### Chat (`/api/v1/chat/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/chat/message` | Any | Send message, get AI response |
| GET | `/chat/sessions` | Any | List user's chat sessions |
| GET | `/chat/history/{session_id}` | Any | Get session messages |
| DELETE | `/chat/sessions/{session_id}` | Any | Delete session |

#### Releases (`/api/v1/releases/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/releases` | Any | List releases (paginated) |
| POST | `/releases` | Manager | Create release |
| GET | `/releases/{id}` | Any | Get release details |
| PUT | `/releases/{id}` | Manager | Update release |
| DELETE | `/releases/{id}` | Admin | Delete release |
| GET | `/releases/clients` | Any | Client release tracking |
| PUT | `/releases/clients/{id}` | Manager | Update client release |

#### Issues (`/api/v1/issues/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/issues` | Any | List issues (paginated) |
| POST | `/issues` | Any | Create issue |
| GET | `/issues/{id}` | Any | Get issue |
| PUT | `/issues/{id}` | Any | Update issue |
| DELETE | `/issues/{id}` | Manager | Delete issue |
| GET | `/issues/stats` | Any | Summary counts |
| POST | `/issues/search` | Any | Full-text search |

#### Logs (`/api/v1/logs/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/logs` | Any | System/app log entries |
| GET | `/logs/audit` | Admin | Audit trail |
| GET | `/logs/system` | Admin | System events |

#### Documents (`/api/v1/documents/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/documents` | Any | List documents |
| POST | `/documents/upload` | Any | Upload file (multipart) |
| GET | `/documents/{id}` | Any | Get document |
| DELETE | `/documents/{id}` | Manager | Delete document |
| POST | `/documents/reindex` | Manager | Trigger re-indexing |

#### Emails (`/api/v1/emails/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/emails` | Any | List emails |
| GET | `/emails/{id}` | Any | Get email |
| POST | `/emails/send` | Any | Send email |
| POST | `/emails/draft` | Any | AI-generate draft |

#### Meetings (`/api/v1/meetings/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/meetings` | Any | List meetings |
| POST | `/meetings` | Any | Create meeting |
| PUT | `/meetings/{id}` | Any | Update meeting |
| POST | `/meetings/{id}/generate-mom` | Any | AI-generate MOM |

#### Knowledge Base (`/api/v1/knowledge/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/knowledge/error-codes` | Any | Error code database |
| GET | `/knowledge/circulars` | Any | Exchange circulars |
| GET | `/knowledge/flags` | Any | Trading flags |
| GET | `/knowledge/greek-codes` | Any | Greek/exchange codes |
| GET | `/knowledge/test-cases` | Any | Test case library |

#### Indexing (`/api/v1/indexing/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/indexing/status` | Any | Current indexing status |
| POST | `/indexing/reindex` | Manager | Start full reindex |
| POST | `/indexing/root-folder` | Admin | Set root data folder |
| GET | `/indexing/stats` | Any | File statistics |

#### Search (`/api/v1/search`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/search` | Any | Global search across all sources |

#### Health (Public)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | Public | `{"status":"healthy"}` |
| GET | `/` | Public | API info |

---

### 2.5 WebSocket (`/ws/chat/{client_id}`)

```
Protocol (streaming AI chat):
Client connects → /ws/chat/my-unique-id

Client sends: {"message": "Why did order 130022999 fail?"}

Server streams:
  → {"type": "typing"}
  → {"type": "token", "content": "Based"}
  → {"type": "token", "content": " on"}
  → {"type": "token", "content": " the"}
  ... (token by token)
  → {"type": "done", "session_id": "abc123", "sources": [...]}

Error: {"type": "error", "message": "..."}
```

---

## PART 3 — DOCKER

### 3.1 Container Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    releaseiq_net (bridge)                │
│                                                          │
│  ┌──────────────┐    ┌──────────────────────────────┐   │
│  │   frontend   │    │          backend              │   │
│  │  Nginx:80    │───▶│       FastAPI:8000            │   │
│  │  host:3000   │    │       host:8000               │   │
│  └──────────────┘    └──────┬──────┬──────┬──────────┘   │
│                             │      │      │              │
│              ┌──────────────┘      │      └──────────────┐
│              ▼                     ▼                     ▼
│  ┌───────────────────┐  ┌──────────────────┐  ┌─────────────────┐
│  │     postgres      │  │     chromadb     │  │     redis       │
│  │  PostgreSQL 16    │  │  Vector Store    │  │  Cache/Queue    │
│  │  host:5432        │  │  host:8001       │  │  host:6379      │
│  └───────────────────┘  └──────────────────┘  └─────────────────┘
│              │
│  ┌───────────────────┐
│  │     ollama        │
│  │  LLM Inference    │
│  │  host:11434       │
│  └───────────────────┘
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

### 3.2 Docker Commands

#### Production (Full Stack)
```bash
cd /home/force/Desktop/releaseiq

# Start all services:
docker-compose up -d

# Start specific service:
docker-compose up -d postgres redis

# View all running containers:
docker-compose ps

# View logs (all):
docker-compose logs -f

# View logs (specific service):
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop all:
docker-compose down

# Stop and remove volumes (WIPES DATABASE):
docker-compose down -v

# Rebuild images:
docker-compose build --no-cache

# Scale backend (multiple workers):
docker-compose up -d --scale backend=3
```

#### Development (Hot Reload)
```bash
# Uses docker-compose.dev.yml override:
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Frontend on port 5173 (Vite HMR), Backend on 8000 with --reload
# Source code is volume-mounted → changes reflect instantly
```

#### Ollama (AI Models)
```bash
# Pull models after Ollama container starts:
docker exec releaseiq_ollama ollama pull llama3
docker exec releaseiq_ollama ollama pull mistral
docker exec releaseiq_ollama ollama pull nomic-embed-text

# List available models:
docker exec releaseiq_ollama ollama list

# Test Ollama API:
curl http://localhost:11434/api/tags
```

---

### 3.3 Dockerfile Details

#### Frontend Production (`docker/Dockerfile.frontend`)
```
Stage 1 — Build (node:20-alpine):
  COPY package*.json → npm ci
  COPY frontend/ → npm run build
  Output: /app/dist/

Stage 2 — Serve (nginx:1.27-alpine):
  COPY docker/nginx.conf → /etc/nginx/nginx.conf
  COPY dist/ → /usr/share/nginx/html/
  Runs as: USER nginx (non-root)
  Port: 80
  Healthcheck: wget http://localhost/health
```

#### Backend Production (`docker/Dockerfile.backend`)
```
Stage 1 — Build (python:3.11-slim):
  apt: build-essential, gcc, libpq-dev
  pip install requirements.txt → /install/

Stage 2 — Runtime (python:3.11-slim):
  apt: libpq5, curl (runtime only)
  COPY --from=builder /install → /usr/local
  COPY backend/ → /app/
  Creates: data/chroma, data/files, data/uploads
  Runs as: USER releaseiq (non-root)
  Port: 8000
  CMD: uvicorn --workers 2
  Healthcheck: curl http://localhost:8000/health
```

#### Frontend Dev (`docker/Dockerfile.frontend.dev`)
```
Base: node:20-alpine
npm install (includes devDependencies)
CMD: npm run dev --host 0.0.0.0 --port 5173
Volume mounted: ./frontend/src → /app/src (HMR)
```

#### Backend Dev (`docker/Dockerfile.backend.dev`)
```
Base: python:3.11-slim
pip install requirements.txt
CMD: uvicorn --reload --reload-dir /app/app
Volume mounted: ./backend/app → /app/app (live reload)
```

---

### 3.4 Nginx Configuration Details

```nginx
# Serves: http://localhost:3000 (production)
# File: docker/nginx.conf

# Static assets (JS/CSS/images):
# → Cache-Control: public, immutable, 1 year
# → Served directly from /usr/share/nginx/html/

# API proxy (/api/*):
# → proxy_pass http://backend:8000
# → Strips & forwards headers (X-Real-IP, X-Forwarded-For, etc.)
# → Timeout: 120s

# WebSocket proxy (/ws/*):
# → proxy_pass http://backend:8000
# → Upgrade: websocket
# → Timeout: 86400s (24 hours — keeps long WS connections alive)

# FastAPI docs proxy (/docs, /redoc, /openapi.json):
# → proxy_pass http://backend:8000

# SPA fallback (React Router):
# → All unknown paths → /index.html
# → Allows client-side routing to work

# Security headers:
# X-Frame-Options: SAMEORIGIN
# X-Content-Type-Options: nosniff
# X-XSS-Protection: 1; mode=block

# Gzip compression:
# → text/plain, text/css, application/json, application/javascript, etc.
# → min_length: 1024 bytes
# → comp_level: 6

# Health endpoint:
# GET /health → {"status":"ok"} (for Docker healthcheck, no backend needed)
```

---

### 3.5 Docker Volumes

| Volume Name | Service | Purpose | Data |
|-------------|---------|---------|------|
| `postgres_data` | postgres | Database files | All DB tables |
| `redis_data` | redis | Cache persistence | Sessions, task queue |
| `chroma_data` | chromadb | Vector embeddings | Document embeddings |
| `ollama_models` | ollama | Downloaded AI models | Llama3, Mistral, etc. |
| `backend_data` | backend | App data directory | Uploads, files, local chroma |

```bash
# List all volumes:
docker volume ls | grep releaseiq

# Backup postgres data:
docker exec releaseiq_postgres pg_dump -U releaseiq releaseiq > backup.sql

# Restore postgres:
cat backup.sql | docker exec -i releaseiq_postgres psql -U releaseiq releaseiq

# Inspect volume:
docker volume inspect releaseiq_postgres_data
```

---

### 3.6 Environment Variables for Docker

Create a `.env` file in the project root before running docker-compose:

```bash
# /home/force/Desktop/releaseiq/.env   (for docker-compose)

# Change these secrets in production!
SECRET_KEY=your-very-secret-key-32-chars-min
JWT_SECRET_KEY=your-jwt-secret-key-32-chars-min

# Database
POSTGRES_USER=releaseiq
POSTGRES_PASSWORD=your-db-password
POSTGRES_DB=releaseiq
DATABASE_URL=postgresql+asyncpg://releaseiq:your-db-password@postgres:5432/releaseiq

# AI Model selection
AI_MODEL=llama3
AI_EMBEDDING_MODEL=nomic-embed-text

# Frontend URL (for CORS)
ALLOWED_ORIGINS=http://yourdomain.com,https://yourdomain.com
```

---

### 3.7 Health Checks Summary

| Service | Health Check Command | Interval | Retries |
|---------|---------------------|----------|---------|
| frontend | `wget -qO- http://localhost/health` | 30s | 3 |
| backend | `curl -f http://localhost:8000/health` | 30s | 3 |
| postgres | `pg_isready -U releaseiq -d releaseiq` | 10s | 5 |
| redis | `redis-cli ping` | 10s | 5 |
| chromadb | `curl -f http://localhost:8000/api/v1/heartbeat` | 30s | 3 |
| ollama | `curl -f http://localhost:11434/api/tags` | 30s | 5 |

---

### 3.8 Switch from SQLite to PostgreSQL

```bash
# Step 1: Start PostgreSQL container only
cd /home/force/Desktop/releaseiq
docker-compose up -d postgres

# Step 2: Update backend/.env
DATABASE_URL=postgresql+asyncpg://releaseiq:releaseiq@localhost:5432/releaseiq

# Step 3: Install asyncpg locally (if running backend outside Docker)
pip3 install --user asyncpg

# Step 4: Run migrations
cd backend
alembic upgrade head

# Step 5: Start backend (auto-seeds the new PostgreSQL database)
python3 run.py
```

---

## PART 4 — QUICK REFERENCE CARD

### Start Development (No Docker)
```bash
# Terminal 1 — Backend
cd /home/force/Desktop/releaseiq/backend
python3 run.py
# → http://localhost:8000  |  Docs: http://localhost:8000/docs

# Terminal 2 — Frontend
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 20
cd /home/force/Desktop/releaseiq/frontend
npm run dev
# → http://localhost:3000
```

### Start Production (Docker)
```bash
cd /home/force/Desktop/releaseiq
docker-compose up -d
# → http://localhost:3000 (Nginx + React)
# → http://localhost:8000 (FastAPI direct)
```

### Test Login via API
```bash
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' | python3 -m json.tool
```

### Reset Database
```bash
cd /home/force/Desktop/releaseiq/backend
rm releaseiq.db && python3 run.py   # re-seeds automatically
```

### View All Tables
```bash
cd /home/force/Desktop/releaseiq/backend
sqlite3 releaseiq.db '.tables'
sqlite3 releaseiq.db '.schema users'
sqlite3 releaseiq.db 'SELECT * FROM users;'
```

# ReleaseIQ — Complete Project Documentation
## Handover Guide for New Claude Session

**Project Location:** `/home/force/Desktop/releaseiq/`  
**Current Status:** ✅ WORKING — Frontend + Backend both running and functional  
**Last Session Summary:** Built complete platform from scratch, fixed dashboard blank-page bug and analytics API mismatch.

---

## 1. QUICK START (Run Immediately)

### Start Both Services

```bash
# Terminal 1 — Backend (FastAPI)
cd /home/force/Desktop/releaseiq/backend
python3 run.py
# Runs at: http://localhost:8000
# API Docs: http://localhost:8000/docs

# Terminal 2 — Frontend (React/Vite)
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 20
cd /home/force/Desktop/releaseiq/frontend
npm run dev
# Runs at: http://localhost:3000
```

### Or use the startup script:
```bash
cd /home/force/Desktop/releaseiq
./start.sh
```

### Default Login Credentials
| Username   | Password     | Role    |
|------------|--------------|---------|
| admin      | admin123     | Admin   |
| manager1   | manager123   | Manager |
| user1      | user123      | User    |

---

## 2. SYSTEM ARCHITECTURE

```
releaseiq/
├── frontend/          React 18 + TypeScript + Vite + Tailwind CSS
├── backend/           Python 3.9 + FastAPI + SQLAlchemy + SQLite
├── docker/            Dockerfiles + Nginx config
├── docker-compose.yml Production stack (Postgres, Redis, ChromaDB, Ollama)
├── docker-compose.dev.yml  Dev overrides
├── start.sh           One-command dev startup
├── Makefile           30+ make commands
└── README.md          General readme
```

### Architecture Flow
```
Browser (React App)
      ↓ HTTP/WebSocket
Vite Dev Server :3000  →  proxy /api/* → FastAPI :8000
                           proxy /ws/*  → FastAPI :8000
      ↓
FastAPI Application
      ↓
SQLite DB (releaseiq.db)   ← dev
PostgreSQL                  ← prod (via Docker)
      ↓
AI Services (optional)
Ollama :11434 → Llama3/Mistral/DeepSeek
ChromaDB → Vector search
```

---

## 3. TECH STACK

### Frontend
| Tool | Version | Purpose |
|------|---------|---------|
| React | 18.3.1 | UI framework |
| TypeScript | 5.5.3 | Type safety |
| Vite | 5.3.5 | Build tool / dev server |
| Tailwind CSS | 3.4.7 | Styling |
| Framer Motion | 11.x | Animations |
| Recharts | 2.x | Charts/analytics |
| React Router | 6.26 | Client routing |
| TanStack Query | 5.x | Server state/caching |
| Zustand | 4.5 | Client state management |
| Radix UI | various | Headless UI primitives |
| Lucide React | 0.417 | Icons |
| Axios | 1.7 | HTTP client |

### Backend
| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.9 | Runtime |
| FastAPI | 0.111 | Web framework |
| Uvicorn | 0.30 | ASGI server |
| SQLAlchemy | 2.0.31 | ORM (async) |
| Alembic | 1.13 | DB migrations |
| Pydantic | 2.8 | Data validation |
| pydantic-settings | 2.3 | Config from env |
| python-jose | 3.3 | JWT tokens |
| passlib[bcrypt] | 1.7 | Password hashing |
| structlog | 24.2 | Structured logging |
| aiosqlite | 0.22 | Async SQLite driver |
| LangChain | 0.2.7 | AI orchestration |
| ChromaDB | 0.5.3 | Vector database |
| sentence-transformers | 3.x | Embeddings |
| ollama | 0.2 | Local AI models |

---

## 4. COMPLETE FILE STRUCTURE

### Frontend (`frontend/src/`)

```
src/
├── main.tsx                    App entry point, theme init, QueryClient, ErrorBoundary
├── App.tsx                     Router config, RequireAuth guard, lazy page loading
├── index.css                   Tailwind base + CSS variables (light/dark themes)
├── vite-env.d.ts               Vite ImportMeta type declaration
│
├── types/
│   └── index.ts                ALL TypeScript interfaces:
│                               User, UserRole, AuthState, LoginCredentials,
│                               Release, JiraIssue, LogFile, ChatMessage,
│                               MessageSource, DashboardStats, Client,
│                               Notification, SearchResult, Email, Meeting,
│                               ErrorCode, ExchangeCircular, FlagDetail,
│                               PaginatedResponse, ApiError, Theme
│
├── store/
│   ├── authStore.ts            Zustand persist store: user, token, isAuthenticated
│   │                           Actions: setAuth, clearAuth, setLoading, updateUser
│   └── uiStore.ts              Zustand persist store: theme, sidebarCollapsed
│                               Actions: setTheme (applies CSS class to <html>),
│                               toggleSidebar, setActiveModule, setNotifications
│
├── services/
│   └── api.ts                  Axios client + all API modules:
│                               authApi, usersApi, chatApi, releasesApi,
│                               issuesApi, logsApi, documentsApi, analyticsApi,
│                               searchApi, emailsApi, meetingsApi,
│                               knowledgeApi, indexingApi
│                               Auto-adds Bearer token from authStore
│                               Auto-redirects to /login on 401
│
├── utils/
│   └── cn.ts                   clsx + tailwind-merge helper function
│
├── hooks/
│   └── useToast.ts             Toast notification state manager hook
│
├── components/
│   ├── ui/                     ShadCN-style design system components:
│   │   ├── button.tsx          variants: default/destructive/outline/secondary/ghost/link
│   │   ├── input.tsx           Forwarded ref input
│   │   ├── badge.tsx           variants: default/secondary/destructive/outline/success/warning
│   │   ├── card.tsx            Card/CardHeader/CardTitle/CardDescription/CardContent/CardFooter
│   │   ├── skeleton.tsx        animate-pulse loading placeholder
│   │   ├── avatar.tsx          Radix Avatar (Root/Image/Fallback)
│   │   ├── dialog.tsx          Radix Dialog (modal)
│   │   ├── dropdown-menu.tsx   Radix DropdownMenu
│   │   ├── tabs.tsx            Radix Tabs
│   │   ├── scroll-area.tsx     Radix ScrollArea
│   │   ├── separator.tsx       Radix Separator
│   │   ├── tooltip.tsx         Radix Tooltip + TooltipProvider
│   │   ├── toast.tsx           Radix Toast
│   │   ├── toaster.tsx         Toast container component
│   │   ├── select.tsx          Radix Select
│   │   ├── label.tsx           Radix Label
│   │   ├── switch.tsx          Radix Switch
│   │   └── progress.tsx        Radix Progress
│   │
│   ├── layout/
│   │   ├── Sidebar.tsx         Collapsible left nav (230px/64px)
│   │   │                       Sections: Main Nav, More Modules, Data Source,
│   │   │                       Quick Stats, Need Help?
│   │   │                       Uses NavLink with active highlighting
│   │   ├── Header.tsx          Top bar: hamburger, search (Ctrl+K), theme toggle,
│   │   │                       notifications bell, user avatar dropdown
│   │   └── AppLayout.tsx       Flex layout: Sidebar + (Header + <Outlet>)
│   │                           NO opacity animations (was causing blank page bug)
│   │
│   ├── auth/
│   │   └── LoginPage.tsx       Split panel: gradient hero (left) + login form (right)
│   │                           Calls authApi.login → setAuth → navigate('/')
│   │
│   └── shared/
│       ├── ErrorBoundary.tsx   Class-based React ErrorBoundary
│       │                       Shows error message + "Try again" button
│       ├── LoadingSpinner.tsx  Sizes: xs/sm/md/lg/xl, centered prop
│       ├── PageHeader.tsx      Title + subtitle + breadcrumbs + actions slot
│       ├── StatusBadge.tsx     Status colors: healthy/warning/critical/open/
│       │                       resolved/in_progress/scheduled/completed
│       └── EmptyState.tsx      Icon + title + description + CTA button
│
└── pages/
    ├── ChatPage.tsx            AI Chat Assistant
    │                           ChatGPT-style interface with right panel
    │                           Mock responses when API unavailable
    ├── DashboardPage.tsx       Analytics dashboard with 6 stat cards + 3 charts
    │                           mapApiStats() handles backend response format
    ├── ReleasesPage.tsx        Tabs: All/QA/Live/Client releases, filter bar
    ├── JiraIssuesPage.tsx      Sortable table, status/priority filters, detail dialog
    ├── LogsExplorerPage.tsx    Module tabs, file list, log viewer, analyze button
    ├── DocumentsPage.tsx       Drag-drop upload, type filters, document cards
    ├── AnalyticsPage.tsx       Date range picker + 4 Recharts charts
    ├── SettingsPage.tsx        6 tabs: General/Indexing/AI/Notifications/Security/About
    ├── UsersPage.tsx           CRUD table with create/edit dialogs (admin only)
    ├── EmailsPage.tsx          Split-panel inbox + AI-draft compose
    ├── MeetingsPage.tsx        Meeting cards + schedule + MOM generation
    ├── SearchPage.tsx          Global search with source filters + results
    ├── ErrorCodesPage.tsx      Expandable table: code/severity/module/resolution
    ├── FlagsPage.tsx           4 tabs: Trading/INI/Runtime/Exchange flags
    └── ClientReleasesPage.tsx  Client table with version, env, health, audit trail
```

### Backend (`backend/app/`)

```
app/
├── main.py                     FastAPI factory:
│                               - CORS middleware (configurable origins)
│                               - AuthMiddleware (JWT validation)
│                               - lifespan: init_db + seed_if_empty
│                               - Health endpoint: GET /health
│                               - WebSocket: /ws/chat/{client_id}
│                               - Error handlers: 404, 405, 422, 500
│
├── core/
│   ├── config.py               Settings class (pydantic-settings):
│   │                           APP_NAME, APP_VERSION, DEBUG, ENVIRONMENT
│   │                           DATABASE_URL (default: sqlite+aiosqlite:///./releaseiq.db)
│   │                           JWT_SECRET_KEY, JWT_ALGORITHM
│   │                           ACCESS_TOKEN_EXPIRE_MINUTES=60
│   │                           REFRESH_TOKEN_EXPIRE_DAYS=7
│   │                           OLLAMA_BASE_URL, AI_MODEL, AI_EMBEDDING_MODEL
│   │                           CHROMA_PERSIST_DIR, ROOT_DATA_FOLDER
│   │                           ALLOWED_ORIGINS
│   ├── database.py             Async SQLAlchemy engine
│   │                           Base (declarative), AsyncSessionLocal
│   │                           get_db() dependency, init_db()
│   ├── security.py             bcrypt hashing, JWT create/verify
│   │                           create_access_token, create_refresh_token
│   │                           verify_token → TokenPayload
│   └── logging.py              structlog config (console dev / JSON prod)
│                               IMPORTANT: removed add_logger_name processor
│                               (caused PrintLogger AttributeError on startup)
│
├── models/                     SQLAlchemy ORM models
│   ├── user.py                 User(id,email,username,full_name,hashed_password,
│   │                               role,is_active,created_at,updated_at,last_login)
│   │                           AuditLog(id,user_id,action,resource_type,detail,ip)
│   │                           UserRole enum: admin/manager/user
│   ├── release.py              Release(id,version,name,description,status,
│   │                               planned_date,release_date,release_notes,
│   │                               jira_project_key,tags[JSON])
│   │                           ClientRelease, DeploymentHistory
│   │                           ReleaseStatus enum: planned/in_progress/testing/
│   │                               staging/released/rolled_back/cancelled
│   ├── issue.py                JiraIssue(id,jira_key,title,description,status,
│   │                               priority,type,assignee,reporter,module,
│   │                               affected_versions[JSON],fix_versions[JSON])
│   │                           IssueStatus, IssuePriority, IssueType enums
│   ├── document.py             Document, IndexingJob models
│   └── chat.py                 ChatSession, ChatMessage, MessageRole enum
│
├── schemas/                    Pydantic request/response schemas
│   ├── auth.py                 LoginRequest, TokenResponse, ChangePasswordRequest
│   ├── user.py                 UserCreate, UserUpdate, UserResponse, UserListResponse
│   ├── release.py              ReleaseCreate, ReleaseUpdate, ReleaseResponse
│   ├── issue.py                IssueCreate, IssueUpdate, IssueResponse
│   └── chat.py                 ChatMessageRequest, ChatMessageResponse, SessionResponse
│
├── api/v1/endpoints/           API route handlers
│   ├── auth.py                 POST /auth/login → TokenResponse
│   │                           GET  /auth/me → UserResponse
│   │                           POST /auth/logout
│   │                           POST /auth/refresh
│   │                           POST /auth/change-password
│   ├── users.py                GET    /users  (admin only, paginated)
│   │                           POST   /users  (admin only)
│   │                           GET    /users/{id}
│   │                           PUT    /users/{id}
│   │                           DELETE /users/{id}
│   │                           POST   /users/{id}/reset-password
│   │                           POST   /users/{id}/toggle-active
│   ├── analytics.py            GET /analytics/dashboard
│   │                           ⚠️ Returns BOTH flat fields AND nested:
│   │                           {files_indexed, jira_issues, releases,
│   │                            log_files, documents, active_clients,
│   │                            releases_detail:{...}, issues:{...},
│   │                            deployments:{...}, clients:{...}}
│   │                           GET /analytics/releases/trend
│   │                           GET /analytics/issues/by-status
│   │                           GET /analytics/issues/by-priority
│   │                           GET /analytics/velocity
│   │                           GET /analytics/log-errors
│   │                           GET /analytics/deployment-success-rate
│   ├── chat.py                 POST /chat/message
│   │                           GET  /chat/history/{session_id}
│   │                           GET  /chat/sessions
│   │                           DELETE /chat/sessions/{session_id}
│   │                           Uses Ollama if available, falls back to
│   │                           keyword-based mock responses
│   ├── releases.py             CRUD /releases + /releases/clients
│   ├── issues.py               CRUD /issues + /issues/stats
│   ├── logs.py                 GET /logs, /logs/audit, /logs/system
│   ├── documents.py            GET/POST /documents + /documents/upload
│   │                           POST /documents/reindex
│   ├── emails.py               CRUD /emails + POST /emails/send
│   │                           POST /emails/draft (AI draft generation)
│   ├── meetings.py             CRUD /meetings + POST /meetings/{id}/generate-mom
│   ├── knowledge.py            GET /knowledge/error-codes
│   │                           GET /knowledge/circulars
│   │                           GET /knowledge/flags
│   │                           GET /knowledge/greek-codes
│   │                           GET /knowledge/test-cases
│   ├── indexing.py             GET  /indexing/status
│   │                           POST /indexing/reindex
│   │                           POST /indexing/root-folder
│   │                           GET  /indexing/stats
│   └── search.py               POST /search (global full-text)
│
├── services/
│   ├── auth_service.py         authenticate_user, create_tokens, refresh_tokens,
│   │                           change_password, reset_password
│   ├── user_service.py         CRUD with role guards, pagination
│   ├── ai_service.py           AIService class:
│   │                           generate_response(query, context) → Ollama or template
│   │                           analyze_fix_log(content) → structured analysis
│   │                           generate_rca, summarize_release, detect_intent
│   │                           stream_response (async generator for WebSocket)
│   ├── fix_parser.py           FIXParser class:
│   │                           parse_message(raw) → FIXMessage dataclass
│   │                           parse_session_log(lines) → FIXSession
│   │                           analyze_order_lifecycle → OrderAnalysis
│   │                           FIX message types: 35=D/G/F/8
│   └── indexing_service.py     IndexingService:
│                               index_folder, parse_log_file, parse_fix_log
│                               Supports: .log .txt .json .csv .xlsx .pdf .docx
│                               ChromaDB embeddings with sentence-transformers
│
├── middleware/
│   └── auth.py                 JWT validation middleware (excludes /health, /docs,
│                               /api/v1/auth/login, /ws/*)
│
├── utils/
│   ├── dependencies.py         FastAPI deps: get_current_user, require_admin,
│   │                           require_manager, CurrentUser, AdminUser, ManagerUser
│   └── seed_data.py            seed_if_empty(): creates admin/manager1/user1,
│                               4 sample releases, 10 sample issues,
│                               client releases + deployment history
│
└── api/v1/websocket/
    ├── manager.py              ConnectionManager (connect/disconnect/broadcast)
    └── chat_ws.py              chat_websocket_handler: streams tokens from AI
                                Protocol: {type:"typing"} → {type:"token",content:...}
                                → {type:"done"}
```

---

## 5. ROUTING MAP

### Frontend Routes (react-router-dom)
| URL Path | Component | Description |
|----------|-----------|-------------|
| `/login` | LoginPage | Public login page |
| `/` | → redirect | Redirects to /dashboard |
| `/dashboard` | DashboardPage | Stats + charts overview |
| `/chat` | ChatPage | AI Chat Assistant |
| `/search` | SearchPage | Global search |
| `/releases` | ReleasesPage | Release management |
| `/jira` | JiraIssuesPage | JIRA issue tracker |
| `/logs` | LogsExplorerPage | Log file explorer |
| `/documents` | DocumentsPage | Knowledge base docs |
| `/analytics` | AnalyticsPage | Advanced analytics |
| `/settings` | SettingsPage | App configuration |
| `/users` | UsersPage | User management (admin) |
| `/emails` | EmailsPage | Email management |
| `/meetings` | MeetingsPage | Meeting scheduler |
| `/circulars` | AnalyticsPage | Exchange circulars (placeholder) |
| `/error-codes` | ErrorCodesPage | Error code database |
| `/flags` | FlagsPage | Trading flags |
| `/clients` | ClientReleasesPage | Client release tracking |

### Sidebar Navigation Links
| Label | Route |
|-------|-------|
| AI Chat Assistant | /chat |
| Dashboard | /dashboard |
| Search | /search |
| Releases | /releases |
| Jira Issues | /jira |
| Logs Explorer | /logs |
| Documents | /documents |
| Analytics | /analytics |
| Settings | /settings |
| Emails | /emails |
| Meetings | /meetings |
| Exchange Circulars | /circulars |
| Error Codes | /error-codes |
| Test Cases | /test-cases ⚠️ (no page yet) |
| Flags | /flags |
| Greek Codes | /greek-codes ⚠️ (no page yet) |
| Client Releases | /client-releases ⚠️ (redirects to /dashboard, need /clients) |

---

## 6. KNOWN ISSUES & BUGS FIXED

### Fixed in This Session

#### BUG 1: Blank Page After Login
- **Cause:** `AppLayout.tsx` used `<motion.main initial={{ opacity: 0 }}>` — started invisible
- **Fix:** Removed framer-motion from `<main>`, content always visible immediately
- **File:** `frontend/src/components/layout/AppLayout.tsx`

#### BUG 2: Dashboard "can't access property toLocaleString, value is undefined"
- **Cause:** Backend `/api/v1/analytics/dashboard` returned nested `{releases: {total:4}}` but
  frontend expected flat `{releases: 18}` per `DashboardStats` type
- **Fix 1 (Backend):** `analytics.py` now returns flat fields at top level:
  `{files_indexed, jira_issues, releases, log_files, documents, active_clients, ...}`
- **Fix 2 (Frontend):** `DashboardPage.tsx` has `mapApiStats()` that safely maps API
  response, with `?? MOCK_STATS.field` fallback for every field
- **Fix 3:** `StatCard` uses `(value ?? 0).toLocaleString()` defensive guard

#### BUG 3: Backend Startup Crash (structlog)
- **Cause:** `structlog.stdlib.add_logger_name` processor called `logger.name` on
  `PrintLogger` which doesn't have a `.name` attribute
- **Fix:** Removed `add_logger_name` from shared_processors in `core/logging.py`

#### BUG 4: Frontend Vite EMFILE Error
- **Cause:** Linux kernel `max_user_instances` for inotify is 128 (too low for Vite's default watcher)
- **Fix:** Set `watch: { usePolling: true, interval: 1000 }` in `vite.config.ts`
- **File:** `frontend/vite.config.ts`

#### BUG 5: `@radix-ui/react-badge` package doesn't exist
- **Cause:** Badge component in ShadCN doesn't use Radix UI
- **Fix:** Removed from `package.json`

#### BUG 6: TypeScript Error — Duplicate `User` identifier in Header.tsx
- **Cause:** `User` imported from both `lucide-react` (icon) and `@/types` (type)
- **Fix:** Renamed lucide import to `User as UserIcon`, type import stays as `User`

### Known Remaining Issues

#### ⚠️ Missing Pages (sidebar links go nowhere or redirect)
- `/test-cases` — no `TestCasesPage.tsx` yet
- `/greek-codes` — no `GreekCodesPage.tsx` yet
- `/client-releases` sidebar link → should map to `/clients` route

#### ⚠️ Sidebar link mismatch
In `Sidebar.tsx`, "Client Releases" path is `/client-releases` but `App.tsx` route
is `/clients`. Fix: change `path: '/client-releases'` to `path: '/clients'` in `Sidebar.tsx`
MORE_MODULES array (line ~64).

#### ⚠️ Analytics page uses mock data
All pages use mock data when API calls fail. The backend APIs for some endpoints
(emails, meetings, knowledge) return hardcoded mock arrays, not database data.

#### ⚠️ AI Chat requires Ollama
Chat AI only works if Ollama is running at `http://localhost:11434`. Without it,
the backend falls back to keyword-based template responses (still functional).

---

## 7. ENVIRONMENT CONFIGURATION

### Backend `.env` file (`backend/.env`)
```bash
APP_NAME=ReleaseIQ
APP_VERSION=1.0.0
DEBUG=false
ENVIRONMENT=development
SECRET_KEY=dev-secret-key-change-in-production

DATABASE_URL=sqlite+aiosqlite:///./releaseiq.db

JWT_SECRET_KEY=dev-jwt-secret-change-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

OLLAMA_BASE_URL=http://localhost:11434
AI_MODEL=llama3
AI_EMBEDDING_MODEL=nomic-embed-text
CHROMA_PERSIST_DIR=./data/chroma

ROOT_DATA_FOLDER=./data/files
UPLOAD_DIR=./data/uploads
MAX_FILE_SIZE_MB=100

ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Frontend `.env` (optional — Vite uses proxy)
```bash
VITE_API_URL=/api/v1
```

---

## 8. DATABASE SCHEMA (SQLite — `backend/releaseiq.db`)

### Tables Created on First Run
```sql
users           id, email, username, full_name, hashed_password,
                role(admin/manager/user), is_active, created_at, updated_at, last_login

audit_logs      id, user_id(FK→users), action, resource_type, resource_id,
                detail, ip_address, created_at

releases        id, version, name, description, status, planned_date, release_date,
                release_notes, created_at, updated_at, created_by, approved_by,
                jira_project_key, issue_count, fixed_issue_count, tags(JSON)

client_releases id, client_name, client_id, current_version, previous_version,
                environment, deployment_date, owner, health_status, notes

deployment_history  id, release_id(FK), client_release_id(FK), environment,
                    status, deployed_by, started_at, completed_at, notes

jira_issues     id, jira_key, title, description, status, priority, type,
                assignee, reporter, module, affected_versions(JSON),
                fix_versions(JSON), created_at, updated_at, release_id(FK)

documents       id, filename, file_path, file_type, file_size, mime_type,
                indexed, index_status, chunk_count, created_at, created_by

indexing_jobs   id, status, folder_path, files_total, files_processed,
                files_failed, started_at, completed_at, error_message

chat_sessions   id, user_id(FK→users), title, created_at, updated_at, is_active

chat_messages   id, session_id(FK→chat_sessions), role(user/assistant/system),
                content, sources(JSON), confidence, created_at
```

---

## 9. API REFERENCE SUMMARY

### Base URL: `http://localhost:8000/api/v1`
### Full Interactive Docs: `http://localhost:8000/docs`

### Authentication
```
POST /auth/login          Body: {username, password} → {access_token, refresh_token, user}
GET  /auth/me             Header: Bearer token → UserResponse
POST /auth/logout         Header: Bearer token
POST /auth/refresh        Body: {refresh_token}
POST /auth/change-password Body: {old_password, new_password}
```

### Users (Admin only)
```
GET    /users             ?page=1&page_size=20&role=&is_active=
POST   /users             Body: UserCreate
GET    /users/{id}
PUT    /users/{id}        Body: UserUpdate
DELETE /users/{id}
POST   /users/{id}/reset-password
POST   /users/{id}/toggle-active
```

### Analytics
```
GET /analytics/dashboard  → {files_indexed, jira_issues, releases, log_files,
                             documents, active_clients, releases_detail, issues,
                             deployments, clients, users}
GET /analytics/releases/trend
GET /analytics/issues/by-status
GET /analytics/issues/by-priority
GET /analytics/velocity
GET /analytics/log-errors
GET /analytics/deployment-success-rate
```

### Chat (AI)
```
POST /chat/message        Body: {message, session_id?} → {response, session_id, sources}
GET  /chat/sessions       → [{id, title, created_at, message_count}]
GET  /chat/history/{sid}  → [{role, content, timestamp}]
DELETE /chat/sessions/{sid}
```

### Releases
```
GET    /releases          ?page=1&page_size=20&status=&version=
POST   /releases
GET    /releases/{id}
PUT    /releases/{id}
DELETE /releases/{id}
GET    /releases/clients  Client release tracking list
PUT    /releases/clients/{id}
```

### Issues
```
GET    /issues            ?page=1&page_size=20&status=&priority=&module=
GET    /issues/{id}
GET    /issues/stats      → summary counts by status/priority
POST   /issues/search     Body: {query}
```

### Knowledge Base
```
GET /knowledge/error-codes    ?module=&severity=
GET /knowledge/circulars      ?exchange=
GET /knowledge/flags          ?type=
GET /knowledge/greek-codes
GET /knowledge/test-cases     ?module=
```

### Search
```
POST /search              Body: {query, filters?: {types?, modules?}}
                          → [{id, type, title, snippet, relevance_score, metadata}]
```

---

## 10. KEY CODE PATTERNS

### How Pages Load Data
```tsx
// Pattern used by all pages:
const { data, isLoading } = useQuery({
  queryKey: ['unique-key'],
  queryFn: async () => {
    try {
      const res = await someApi.list()
      return res.data
    } catch {
      return MOCK_DATA  // always falls back to mock
    }
  }
})
const items = data ?? MOCK_DATA
```

### How Auth Works
```tsx
// Login: LoginPage.tsx
const { access_token, user } = response.data
setAuth(user, access_token)   // stores in Zustand + localStorage
navigate('/')                  // → redirects to /dashboard

// Guard: App.tsx
const RequireAuth = ({ children }) => {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" />
  return <>{children}</>
}

// API calls: services/api.ts
apiClient.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  config.headers.Authorization = `Bearer ${token}`
  return config
})
```

### How Theme Works
```tsx
// In main.tsx — applied BEFORE first render to prevent flash:
const stored = localStorage.getItem('releaseiq-ui')
const theme = JSON.parse(stored)?.state?.theme ?? 'light'
document.documentElement.classList.add(theme)  // adds 'light' or 'dark' to <html>

// In uiStore.ts — when user changes theme:
setTheme: (theme) => {
  set({ theme })
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(theme === 'system' ? (systemDark ? 'dark' : 'light') : theme)
}
```

### Backend Dependency Pattern
```python
# All protected endpoints use:
from app.utils.dependencies import CurrentUser, AdminUser, ManagerUser

@router.get("/something")
async def get_something(
    current_user: CurrentUser,    # any authenticated user
    db: AsyncSession = Depends(get_db),
):
    ...

@router.post("/admin-only")
async def admin_action(
    _: AdminUser,                  # raises 403 if not admin
    db: AsyncSession = Depends(get_db),
):
    ...
```

---

## 11. DEVELOPMENT NOTES

### Node.js Setup (required every terminal session)
```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 20
# NVM installed at ~/.nvm, Node v20.20.2
# Node binary: /home/force/.nvm/versions/node/v20.20.2/bin/node
```

### Vite Polling Mode (important!)
The system has `max_user_instances=128` for inotify (Linux kernel limit).
Vite's default file watcher fails with EMFILE error.
**Must keep** `watch: { usePolling: true }` in `vite.config.ts`.

### Backend Python Path
```bash
# Always run from /home/force/Desktop/releaseiq/backend/
cd /home/force/Desktop/releaseiq/backend
python3 run.py
```

### Database Reset
```bash
cd /home/force/Desktop/releaseiq/backend
rm releaseiq.db       # delete SQLite file
python3 run.py        # restarts and re-seeds automatically
```

### Testing Backend APIs
```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Use token
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/analytics/dashboard
```

---

## 12. WHAT'S DONE vs WHAT'S REMAINING

### ✅ COMPLETED
- [x] Project structure (frontend + backend + docker)
- [x] React app with all 15 pages
- [x] ShadCN UI component library (18 components)
- [x] Left sidebar navigation with collapsible feature
- [x] Header with search, theme toggle, notifications, user menu
- [x] Dark/light mode with persistence
- [x] JWT authentication (login/logout/token refresh)
- [x] Role-based access control (Admin/Manager/User)
- [x] User management CRUD (admin panel)
- [x] AI Chat page with mock responses + structured result cards
- [x] Dashboard with stat cards + 3 Recharts charts (bar, pie, area)
- [x] Release management page (all/QA/live/client tabs)
- [x] JIRA issues tracker with sortable table
- [x] Logs Explorer with module filters + log viewer
- [x] Documents page with drag-drop upload zone
- [x] Analytics page with 4 charts + date range selector
- [x] Settings page with 6 tabs
- [x] Emails page with split-panel inbox + AI draft
- [x] Meetings page with schedule + MOM generation
- [x] Search page with source filters
- [x] Error Codes knowledge base
- [x] Flags page (4 tabs: Trading/INI/Runtime/Exchange)
- [x] Client Releases tracking table
- [x] FastAPI backend with 14 endpoint modules (~40 routes)
- [x] SQLAlchemy async models (User, Release, Issue, Document, Chat)
- [x] Database auto-migration + seeding on startup
- [x] FIX protocol parser service
- [x] AI orchestration service (Ollama + fallback)
- [x] File indexing service (ChromaDB + sentence-transformers)
- [x] WebSocket streaming for chat
- [x] ErrorBoundary (no more blank pages on crash)
- [x] Docker + docker-compose (full production stack)
- [x] Nginx reverse proxy config

### 🔧 TODO / NEXT STEPS
- [ ] Fix sidebar "Client Releases" link: change `/client-releases` → `/clients` in Sidebar.tsx line ~64
- [ ] Create `TestCasesPage.tsx` (knowledge/test-cases API exists)
- [ ] Create `GreekCodesPage.tsx` (knowledge/greek-codes API exists)
- [ ] Wire up Exchange Circulars page (currently shows Analytics as placeholder)
- [ ] Connect emails page to real SMTP (settings: smtp host/port/credentials)
- [ ] Persist chat history to database (ChatSession/ChatMessage models exist)
- [ ] Wire up document upload to actually index to ChromaDB
- [ ] Real JIRA API integration (import from JIRA REST API)
- [ ] Real-time notifications via WebSocket
- [ ] Export to PDF/Excel functionality
- [ ] Alembic migrations for schema evolution
- [ ] Add more Recharts on Analytics page (log error rates by module)
- [ ] Production build optimization
- [ ] OAuth/SSO integration placeholder

---

## 13. DOCKER DEPLOYMENT

```bash
# Production (with Postgres, Redis, ChromaDB, Ollama)
cd /home/force/Desktop/releaseiq
docker-compose up -d

# Development hot-reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Services:
# frontend  → localhost:3000  (Nginx + React build)
# backend   → localhost:8000  (FastAPI)
# postgres  → localhost:5432
# redis     → localhost:6379
# chromadb  → localhost:8001
# ollama    → localhost:11434
```

### Switch to PostgreSQL
1. Edit `backend/.env`:
   ```
   DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/releaseiq
   ```
2. Install: `pip3 install --user asyncpg`
3. Run migrations: `alembic upgrade head`

---

## 14. HOW TO GIVE THIS CONTEXT TO NEXT CLAUDE SESSION

Paste this at the start of your new session:

```
I am continuing development of the ReleaseIQ platform located at 
/home/force/Desktop/releaseiq/. Please read the complete documentation at
/home/force/Desktop/releaseiq/PROJECT_DOCUMENTATION.md before we begin.

The project is a full-stack enterprise AI platform:
- Frontend: React + TypeScript + Vite at localhost:3000
- Backend: FastAPI + Python at localhost:8000
- Docs: http://localhost:8000/docs
- Login: admin / admin123

Start services:
  Backend:  cd /home/force/Desktop/releaseiq/backend && python3 run.py
  Frontend: export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 20 && cd /home/force/Desktop/releaseiq/frontend && npm run dev

What I need help with next: [describe your task]
```

# ReleaseIQ

Enterprise release management platform with AI-powered chat, FIX protocol log analysis, Jira integration, and real-time collaboration.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│                    Browser                       │
│            React + Vite + TailwindCSS            │
└────────────────────┬─────────────────────────────┘
                     │ HTTP / WebSocket
┌────────────────────▼─────────────────────────────┐
│               Nginx (port 3000)                  │
│  /api/*  →  FastAPI backend                      │
│  /ws/*   →  WebSocket (AI streaming)             │
│  /*      →  React SPA                            │
└───────────┬──────────────┬───────────────────────┘
            │              │
┌───────────▼──┐   ┌───────▼────────────────────────┐
│  FastAPI     │   │  Ollama (llama3 / custom model)  │
│  Python 3.11 │   │  Local LLM inference             │
│  port 8000   │   └────────────────────────────────┘
└──┬───┬───┬───┘
   │   │   │
┌──▼─┐ │ ┌─▼──────┐
│ PG │ │ │ChromaDB│  ← vector store for RAG
└────┘ │ └────────┘
     ┌─▼──┐
     │Redis│  ← task queue / session cache
     └─────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, shadcn/ui |
| Backend | FastAPI, Python 3.11, SQLAlchemy 2 (async), Alembic |
| AI/LLM | Ollama (llama3), sentence-transformers, ChromaDB |
| Database | PostgreSQL 16 |
| Cache / Queue | Redis 7 |
| Containerisation | Docker, Docker Compose |
| Web Server | Nginx 1.27 |

---

## Prerequisites

- **Docker** ≥ 24 and **Docker Compose** ≥ 2.20  
- (Optional) **Node.js** 20 and **Python** 3.11 for local development  
- (Optional) NVIDIA GPU + `nvidia-container-toolkit` for Ollama GPU acceleration  
- 8 GB RAM recommended (16 GB with Ollama model loaded)

---

## Quick Start (Docker)

```bash
# 1. Clone the repository
git clone https://github.com/your-org/releaseiq.git
cd releaseiq

# 2. Copy environment file and adjust as needed
cp backend/.env.example backend/.env

# 3. Build and start all services
make build
make up

# 4. (First run) Pull an Ollama model
docker exec releaseiq_ollama ollama pull llama3

# 5. Open the application
open http://localhost:3000
```

API documentation: http://localhost:8000/docs

---

## Local Development (without Docker)

### Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and edit environment
cp .env.example .env

# Run migrations
alembic upgrade head

# Start development server
python run.py
# or:
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

npm install
npm run dev
# Opens at http://localhost:5173
```

---

## Development Hot-Reload (Docker)

```bash
# Start with hot-reload for both services
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Frontend: http://localhost:5173  (Vite HMR)
# Backend:  http://localhost:8000  (uvicorn --reload)
```

---

## Environment Variables

Key variables (see `backend/.env.example` for the full list):

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./releaseiq.db` | PostgreSQL URL in production |
| `SECRET_KEY` | `change-me-in-production` | Application secret key |
| `JWT_SECRET_KEY` | `change-me-jwt` | JWT signing secret |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `AI_MODEL` | `llama3` | Ollama model to use |
| `CHROMA_PERSIST_DIR` | `./data/chroma` | ChromaDB storage path |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection URL |

---

## Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@releaseiq.com | admin123 |
| Developer | developer@releaseiq.com | dev123 |
| Viewer | viewer@releaseiq.com | viewer123 |

> Change all passwords immediately after first login in production.

---

## API Documentation

- Swagger UI: http://localhost:8000/docs  
- ReDoc: http://localhost:8000/redoc  
- OpenAPI JSON: http://localhost:8000/openapi.json

### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/auth/login` | Obtain JWT token |
| `GET` | `/api/v1/releases` | List releases |
| `GET` | `/api/v1/issues` | List Jira issues |
| `POST` | `/api/v1/chat/message` | AI chat |
| `GET` | `/api/v1/documents` | List documents |
| `POST` | `/api/v1/documents/upload` | Upload for indexing |
| `GET` | `/api/v1/knowledge/error-codes` | Error code reference |
| `POST` | `/api/v1/indexing/reindex` | Trigger re-indexing |
| `WS` | `/ws/chat/{client_id}` | Streaming AI chat |

---

## Project Structure

```
releaseiq/
├── backend/
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── endpoints/     # REST endpoints
│   │   │   └── websocket/     # WebSocket handlers
│   │   ├── core/              # Config, DB, security, logging
│   │   ├── middleware/        # Auth middleware
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic schemas
│   │   ├── services/          # Business logic (AI, indexing, FIX)
│   │   └── utils/             # Dependencies, seed data
│   ├── alembic/               # Database migrations
│   ├── tests/
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── src/
│   │   ├── components/        # UI components
│   │   ├── pages/             # Route pages
│   │   ├── services/          # API client
│   │   ├── store/             # Zustand state
│   │   └── types/
│   └── package.json
├── docker/
│   ├── Dockerfile.frontend
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend.dev
│   ├── Dockerfile.backend.dev
│   └── nginx.conf
├── docker-compose.yml         # Production
├── docker-compose.dev.yml     # Development overrides
├── Makefile
└── README.md
```

---

## Make Commands

```bash
make install    # Install all dependencies (Python + Node)
make dev        # Start local dev servers (no Docker)
make build      # Build Docker images
make up         # Start all services (production)
make down       # Stop all services
make logs       # Tail all service logs
make seed       # Seed database with sample data
make test       # Run test suite
make lint       # Lint Python and TypeScript
make migrate    # Run Alembic migrations
make shell      # Open backend Python shell
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and add tests
4. Run linting: `make lint`
5. Run tests: `make test`
6. Commit and open a pull request

Please follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

---

## License

Proprietary – GreekSoft Technologies. All rights reserved.

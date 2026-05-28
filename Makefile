# ============================================================
# ReleaseIQ – Makefile
# ============================================================

SHELL := /bin/bash
.DEFAULT_GOAL := help

COMPOSE        := docker compose
COMPOSE_DEV    := $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml
BACKEND_DIR    := backend
FRONTEND_DIR   := frontend
PYTHON         := python3
PIP            := pip3

# Colours
GREEN  := \033[0;32m
YELLOW := \033[0;33m
CYAN   := \033[0;36m
RESET  := \033[0m

.PHONY: help install install-backend install-frontend \
        dev dev-backend dev-frontend \
        build build-backend build-frontend \
        up down restart logs shell \
        migrate migrate-create seed \
        test test-backend test-frontend test-coverage \
        lint lint-backend lint-frontend format \
        clean clean-docker clean-data \
        ollama-pull docs

# ----------------------------------------------------------------
# Help
# ----------------------------------------------------------------
help:
	@echo ""
	@echo "$(CYAN)ReleaseIQ – Available Make Targets$(RESET)"
	@echo "--------------------------------------"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-22s$(RESET) %s\n", $$1, $$2}'
	@echo ""

# ----------------------------------------------------------------
# Install
# ----------------------------------------------------------------
install: install-backend install-frontend ## Install all dependencies

install-backend: ## Install Python backend dependencies
	@echo "$(YELLOW)Installing backend dependencies...$(RESET)"
	cd $(BACKEND_DIR) && $(PIP) install --upgrade pip && $(PIP) install -r requirements.txt
	@echo "$(GREEN)Backend dependencies installed.$(RESET)"

install-frontend: ## Install Node frontend dependencies
	@echo "$(YELLOW)Installing frontend dependencies...$(RESET)"
	cd $(FRONTEND_DIR) && npm install
	@echo "$(GREEN)Frontend dependencies installed.$(RESET)"

# ----------------------------------------------------------------
# Local development (no Docker)
# ----------------------------------------------------------------
dev: ## Start both dev servers locally (requires dependencies installed)
	@echo "$(YELLOW)Starting backend and frontend dev servers...$(RESET)"
	$(MAKE) -j2 dev-backend dev-frontend

dev-backend: ## Start FastAPI dev server with hot-reload
	@echo "$(CYAN)Backend → http://localhost:8000$(RESET)"
	cd $(BACKEND_DIR) && $(PYTHON) -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --log-level debug

dev-frontend: ## Start Vite dev server with HMR
	@echo "$(CYAN)Frontend → http://localhost:5173$(RESET)"
	cd $(FRONTEND_DIR) && npm run dev

# ----------------------------------------------------------------
# Docker
# ----------------------------------------------------------------
build: ## Build all Docker images
	@echo "$(YELLOW)Building Docker images...$(RESET)"
	$(COMPOSE) build --no-cache
	@echo "$(GREEN)Build complete.$(RESET)"

build-backend: ## Build backend Docker image only
	$(COMPOSE) build --no-cache backend

build-frontend: ## Build frontend Docker image only
	$(COMPOSE) build --no-cache frontend

up: ## Start all services (production mode)
	@echo "$(YELLOW)Starting all services...$(RESET)"
	$(COMPOSE) up -d
	@echo "$(GREEN)Services started.$(RESET)"
	@echo "  Frontend:  http://localhost:3000"
	@echo "  Backend:   http://localhost:8000"
	@echo "  API Docs:  http://localhost:8000/docs"
	@echo "  ChromaDB:  http://localhost:8001"
	@echo "  Ollama:    http://localhost:11434"

up-dev: ## Start all services (development mode with hot-reload)
	@echo "$(YELLOW)Starting dev services...$(RESET)"
	$(COMPOSE_DEV) up -d
	@echo "$(GREEN)Dev services started.$(RESET)"
	@echo "  Frontend:  http://localhost:5173"
	@echo "  Backend:   http://localhost:8000"

down: ## Stop and remove all containers
	$(COMPOSE) down

down-dev: ## Stop dev containers
	$(COMPOSE_DEV) down

restart: down up ## Restart all services

logs: ## Tail logs from all services
	$(COMPOSE) logs -f

logs-backend: ## Tail backend logs
	$(COMPOSE) logs -f backend

logs-frontend: ## Tail frontend logs
	$(COMPOSE) logs -f frontend

ps: ## Show running service status
	$(COMPOSE) ps

shell: ## Open a Python shell inside the backend container
	$(COMPOSE) exec backend python -c "import app; print('ReleaseIQ shell ready')"

shell-db: ## Open a psql shell inside the postgres container
	$(COMPOSE) exec postgres psql -U releaseiq -d releaseiq

# ----------------------------------------------------------------
# Database
# ----------------------------------------------------------------
migrate: ## Run pending Alembic migrations
	@echo "$(YELLOW)Running migrations...$(RESET)"
	cd $(BACKEND_DIR) && alembic upgrade head
	@echo "$(GREEN)Migrations complete.$(RESET)"

migrate-create: ## Create a new migration (usage: make migrate-create MSG="add users table")
	@echo "$(YELLOW)Creating migration: $(MSG)$(RESET)"
	cd $(BACKEND_DIR) && alembic revision --autogenerate -m "$(MSG)"

migrate-docker: ## Run migrations inside Docker backend container
	$(COMPOSE) exec backend alembic upgrade head

seed: ## Seed database with sample data
	@echo "$(YELLOW)Seeding database...$(RESET)"
	cd $(BACKEND_DIR) && $(PYTHON) -c "import asyncio; from app.utils.seed_data import run_seed; asyncio.run(run_seed())"
	@echo "$(GREEN)Database seeded.$(RESET)"

seed-docker: ## Seed database via Docker
	$(COMPOSE) exec backend python -c "import asyncio; from app.utils.seed_data import run_seed; asyncio.run(run_seed())"

# ----------------------------------------------------------------
# Testing
# ----------------------------------------------------------------
test: test-backend ## Run all tests

test-backend: ## Run backend Python tests
	@echo "$(YELLOW)Running backend tests...$(RESET)"
	cd $(BACKEND_DIR) && $(PYTHON) -m pytest tests/ -v --tb=short

test-frontend: ## Run frontend tests
	@echo "$(YELLOW)Running frontend tests...$(RESET)"
	cd $(FRONTEND_DIR) && npm test

test-coverage: ## Run backend tests with coverage report
	@echo "$(YELLOW)Running tests with coverage...$(RESET)"
	cd $(BACKEND_DIR) && $(PYTHON) -m pytest tests/ -v --cov=app --cov-report=html --cov-report=term-missing
	@echo "$(GREEN)Coverage report saved to backend/htmlcov/$(RESET)"

test-docker: ## Run tests inside Docker
	$(COMPOSE) exec backend pytest tests/ -v

# ----------------------------------------------------------------
# Linting & formatting
# ----------------------------------------------------------------
lint: lint-backend lint-frontend ## Lint all code

lint-backend: ## Lint Python code (ruff + mypy)
	@echo "$(YELLOW)Linting backend...$(RESET)"
	cd $(BACKEND_DIR) && \
		$(PYTHON) -m ruff check app/ tests/ || true && \
		$(PYTHON) -m mypy app/ --ignore-missing-imports || true

lint-frontend: ## Lint TypeScript code
	@echo "$(YELLOW)Linting frontend...$(RESET)"
	cd $(FRONTEND_DIR) && npm run lint

format: ## Format Python code with ruff/black
	@echo "$(YELLOW)Formatting backend...$(RESET)"
	cd $(BACKEND_DIR) && $(PYTHON) -m ruff format app/ tests/ || $(PYTHON) -m black app/ tests/

# ----------------------------------------------------------------
# AI / Ollama
# ----------------------------------------------------------------
ollama-pull: ## Pull the configured Ollama model (default: llama3)
	@MODEL=$${AI_MODEL:-llama3}; \
	echo "$(YELLOW)Pulling Ollama model: $$MODEL$(RESET)"; \
	docker exec releaseiq_ollama ollama pull $$MODEL; \
	echo "$(GREEN)Model $$MODEL ready.$(RESET)"

ollama-list: ## List downloaded Ollama models
	docker exec releaseiq_ollama ollama list

# ----------------------------------------------------------------
# Cleanup
# ----------------------------------------------------------------
clean: ## Remove Python and Node build artefacts
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	find . -name "*.pyo" -delete 2>/dev/null || true
	rm -rf $(BACKEND_DIR)/htmlcov $(BACKEND_DIR)/.pytest_cache $(BACKEND_DIR)/.coverage
	rm -rf $(FRONTEND_DIR)/dist $(FRONTEND_DIR)/.vite
	@echo "$(GREEN)Artefacts cleaned.$(RESET)"

clean-docker: ## Remove Docker containers, images, and volumes (WARNING: destroys data)
	@echo "$(YELLOW)WARNING: This will remove all ReleaseIQ Docker resources including data volumes.$(RESET)"
	@read -p "Are you sure? [y/N] " ans && [ "$$ans" = "y" ] || exit 1
	$(COMPOSE) down -v --rmi local
	@echo "$(GREEN)Docker resources cleaned.$(RESET)"

clean-data: ## Remove local data directories (chroma, uploads, sqlite)
	@echo "$(YELLOW)WARNING: This will delete local data.$(RESET)"
	@read -p "Are you sure? [y/N] " ans && [ "$$ans" = "y" ] || exit 1
	rm -rf $(BACKEND_DIR)/data $(BACKEND_DIR)/releaseiq.db
	@echo "$(GREEN)Data directories cleaned.$(RESET)"

# ----------------------------------------------------------------
# Documentation
# ----------------------------------------------------------------
docs: ## Open API docs in browser
	@echo "$(CYAN)Opening API docs...$(RESET)"
	xdg-open http://localhost:8000/docs 2>/dev/null || open http://localhost:8000/docs 2>/dev/null || echo "Open http://localhost:8000/docs"

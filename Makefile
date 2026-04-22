# Convenience targets. Run `make help` to list them.

.PHONY: help up down build logs restart clean \
        backend-test frontend-test test \
        backend-shell frontend-shell

help: ## Show this help.
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	 | sort \
	 | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ------------------------------------------------------------------ docker

up: ## Build (if needed) and start the full stack in the foreground.
	docker compose up --build

down: ## Stop and remove containers + network.
	docker compose down

build: ## Build images without starting.
	docker compose build

logs: ## Tail logs from all services.
	docker compose logs -f

restart: ## Restart both services.
	docker compose restart

clean: ## Stop the stack and remove the persistent DB volume.
	docker compose down -v

backend-shell: ## Open a shell in the running backend container.
	docker compose exec backend sh

frontend-shell: ## Open a shell in the running frontend container.
	docker compose exec frontend sh

# --------------------------------------------------------------- local tests

backend-test: ## Run Django tests locally (requires backend/.venv).
	cd backend && . .venv/bin/activate && python manage.py test submissions

frontend-test: ## Run Vitest locally (requires frontend/node_modules).
	cd frontend && npm test

test: backend-test frontend-test ## Run both test suites locally.

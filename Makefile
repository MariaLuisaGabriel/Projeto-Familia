.DEFAULT_GOAL := help
.PHONY: help install db dev migrate migrations test lint fmt arch check

-include .env
export

MANAGE := uv run python manage.py

help: ## Lista os comandos
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  make %-12s %s\n", $$1, $$2}'

install: ## Instala dependências (inclusive de desenvolvimento)
	uv sync

db: ## Sobe o Postgres local e espera ficar pronto
	docker compose up -d --wait db

dev: db ## Sobe Postgres e o servidor Django
	$(MANAGE) migrate
	$(MANAGE) runserver

migrate: db ## Aplica migrações
	$(MANAGE) migrate

migrations: ## Gera migrações a partir dos models
	$(MANAGE) makemigrations

test: db ## Roda a suíte de testes
	uv run pytest

lint: ## ruff (lint + formatação) e pyright
	uv run ruff check .
	uv run ruff format --check .
	uv run pyright

fmt: ## Formata o código e aplica correções automáticas do ruff
	uv run ruff format .
	uv run ruff check --fix .

arch: ## Verifica fronteiras entre camadas e módulos (import-linter)
	uv run lint-imports

check: lint arch test ## Tudo que o CI roda
	$(MANAGE) check
	$(MANAGE) makemigrations --check --dry-run

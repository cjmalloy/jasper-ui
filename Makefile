# Jasper-UI Development Makefile
# Provides simple commands for common development tasks

.PHONY: help setup start start-backend start-full stop test test-docker build build-docker clean

help: ## Show this help message
	@echo "Jasper-UI Development Commands"
	@echo "=============================="
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  %-15s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

setup: ## Set up development environment
	@./setup-dev.sh

start: ## Start frontend development server (http://localhost:4200)
	npm start

start-backend: ## Start backend services only
	npm run start:backend

start-full: ## Start complete dockerized stack (http://localhost:8080)
	npm run start:full --profile with-ui

stop: ## Stop all services
	npm run stop:full

test: ## Run unit tests
	npm test -- --watch=false --browsers=ChromeHeadless

test-docker: ## Run unit tests in Docker
	npm run test:docker

build: ## Build the application
	npm run build

build-docker: ## Build Docker image
	npm run build:docker

clean: ## Clean up Docker containers and volumes
	docker compose -f docker-compose.dev.yaml down -v
	docker system prune -f

install: ## Install dependencies
	npm ci
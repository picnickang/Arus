.PHONY: lint lint-fix format format-check quality setup-hooks help

help: ## Show this help message
	@echo "📋 Available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

lint: ## Run ESLint to check code quality
	@bash scripts/lint.sh

lint-fix: ## Auto-fix ESLint issues
	@bash scripts/lint-fix.sh

format: ## Format code with Prettier
	@bash scripts/format.sh

format-check: ## Check code formatting without changes
	@bash scripts/format-check.sh

quality: ## Run all quality checks (format, lint, typecheck)
	@bash scripts/quality-check.sh

setup-hooks: ## Install git pre-commit hooks
	@bash scripts/setup-hooks.sh

dev: ## Start development server
	@npm run dev

build: ## Build for production
	@npm run build

check: ## Run TypeScript type checking
	@npm run check

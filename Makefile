.PHONY: up down seed check laws notices index api web test lint

up:
	cd infra && docker compose up -d --wait

down:
	cd infra && docker compose down

seed:
	cd backend && uv run woori seed

check:
	cd backend && uv run woori check

laws:
	cd backend && uv run woori laws

notices:
	cd backend && uv run woori notices

index:
	cd backend && uv run woori index

api:
	cd backend && uv run uvicorn woori.api.main:app --reload --port 8000

web:
	cd apps/web && pnpm dev

test:
	cd backend && uv run pytest -q
	cd apps/web && pnpm exec tsc --noEmit && pnpm lint

lint:
	cd backend && uv run ruff check woori tests

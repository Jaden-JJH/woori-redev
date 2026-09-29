# 백엔드 API 이미지(Cloud Run). 빌드 컨텍스트는 저장소 루트(content/ 를 함께 넣는다).
FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never RAW_DIR=/tmp/raw
COPY --from=ghcr.io/astral-sh/uv:0.7.3 /uv /usr/local/bin/uv

WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project --python /usr/local/bin/python3
COPY backend/ ./
COPY content/ /app/content/
RUN uv sync --frozen --no-dev --python /usr/local/bin/python3

ENV PATH=/app/backend/.venv/bin:$PATH
CMD ["sh", "-c", "exec uvicorn woori.api.main:app --host 0.0.0.0 --port ${PORT:-8080} --proxy-headers --forwarded-allow-ips='*'"]

# 백엔드 API 와 수집 Job 공용 이미지. 빌드 컨텍스트는 저장소 루트(content/ 를 함께 넣는다).
FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    RAW_DIR=/tmp/raw \
    REPLAY_DIR=/app/replay

COPY --from=ghcr.io/astral-sh/uv:0.7.3 /uv /usr/local/bin/uv

WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/ ./
COPY content/ /app/content/
COPY replay/ /app/replay/
RUN uv sync --frozen --no-dev

ENV PATH=/app/backend/.venv/bin:$PATH
EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn woori.api.main:app --host 0.0.0.0 --port ${PORT:-8080} --proxy-headers --forwarded-allow-ips='*'"]

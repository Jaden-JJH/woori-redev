from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql://woori:woori@localhost:54329/woori"
    content_dir: Path = REPO_ROOT / "content"
    raw_dir: Path = REPO_ROOT / "data" / "raw"

    # 셸에 이미 있는 공용 ANTHROPIC_API_KEY 등을 실수로 가져가 다른 계정으로 과금되지 않도록 앱 전용 이름만 읽는다.
    anthropic_api_key: str | None = Field(default=None, validation_alias=AliasChoices("WOORI_ANTHROPIC_API_KEY"))
    gemini_api_key: str | None = Field(default=None, validation_alias=AliasChoices("WOORI_GEMINI_API_KEY"))
    law_api_oc: str | None = None

    # 생성 모델: answer_provider 가 기본, fallback_provider 는 장애 시 대체
    answer_provider: str = "claude"
    fallback_provider: str = "gemini"
    claude_model: str = "claude-opus-5"
    claude_analyzer_model: str = "claude-opus-5"
    gemini_model: str = "gemini-2.5-flash"
    embed_model: str = "gemini-embedding-001"
    embed_dim: int = 768

    # 검색과 게이트
    bm25_top_k: int = 30
    vector_top_k: int = 30
    rrf_k: int = 60
    context_top_k: int = 8
    gate_min_rrf: float = 0.025
    gate_min_bm25: float = 4.0

    # 운영
    cors_origins: list[str] = ["http://localhost:3000"]
    rate_limit_per_min: int = 10
    admin_token: str | None = None
    demo_mode: bool = False
    replay_dir: Path = REPO_ROOT / "data" / "replay"


@lru_cache
def get_settings() -> Settings:
    return Settings()

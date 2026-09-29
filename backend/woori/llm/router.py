"""공급자 선택, 장애 폴백, 녹화 응답.

- 기본 공급자가 실패하면 두 번째 공급자로 한 번 더 시도한다.
- WOORI_RECORD=1 이면 성공한 응답을 data/replay/ 에 요청 지문으로 저장한다.
- 키가 없거나 두 공급자가 모두 실패하면 같은 지문의 녹화 응답이 있을 때 그것을 쓴다.
"""

import json
import logging
import os
from functools import lru_cache
from pathlib import Path

from woori.config import get_settings
from woori.llm.base import Embedder, JsonProvider, JsonRequest, JsonResult, LlmError, LlmRefused

log = logging.getLogger(__name__)


class ReplayStore:
    def __init__(self, root: Path):
        self.root = root

    def _path(self, req: JsonRequest) -> Path:
        return self.root / req.task / f"{req.fingerprint()}.json"

    def load(self, req: JsonRequest) -> JsonResult | None:
        p = self._path(req)
        if not p.exists():
            return None
        d = json.loads(p.read_text(encoding="utf-8"))
        return JsonResult(data=d["data"], model=d["model"], provider="replay", usage={})

    def save(self, req: JsonRequest, res: JsonResult) -> None:
        p = self._path(req)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(
            json.dumps({"model": res.model, "provider": res.provider, "data": res.data}, ensure_ascii=False, indent=1),
            encoding="utf-8",
        )


class LlmRouter:
    def __init__(self, providers: list[JsonProvider], replay: ReplayStore, record: bool = False):
        self.providers = providers
        self.replay = replay
        self.record = record

    @property
    def available(self) -> bool:
        return bool(self.providers)

    def generate_json(self, req: JsonRequest) -> JsonResult:
        errors: list[str] = []
        for p in self.providers:
            try:
                res = p.generate_json(req)
                if self.record:
                    self.replay.save(req, res)
                return res
            except LlmRefused as e:
                errors.append(f"{p.name}: refused")
                log.warning("provider %s refused task=%s: %s", p.name, req.task, e)
            except LlmError as e:
                errors.append(f"{p.name}: {e}")
                log.warning("provider %s failed task=%s: %s", p.name, req.task, e)
        cached = self.replay.load(req)
        if cached is not None:
            log.info("replay hit task=%s", req.task)
            return cached
        raise LlmError("; ".join(errors) or "no LLM provider configured and no replay available")


def _build_provider(name: str, analyzer: bool = False) -> JsonProvider | None:
    s = get_settings()
    if name == "claude" and s.anthropic_api_key:
        from woori.llm.claude import ClaudeProvider

        return ClaudeProvider(s.anthropic_api_key, s.claude_analyzer_model if analyzer else s.claude_model)
    if name == "gemini" and s.gemini_api_key:
        from woori.llm.gemini import GeminiProvider

        return GeminiProvider(s.gemini_api_key, s.gemini_model)
    return None


def build_router(primary: str, secondary: str | None, analyzer: bool = False) -> LlmRouter:
    s = get_settings()
    providers = [p for p in (_build_provider(primary, analyzer), _build_provider(secondary or "", analyzer)) if p]
    return LlmRouter(providers, ReplayStore(s.replay_dir), record=os.getenv("WOORI_RECORD") == "1")


@lru_cache
def answer_router() -> LlmRouter:
    s = get_settings()
    return build_router(s.answer_provider, s.fallback_provider)


@lru_cache
def analyzer_router() -> LlmRouter:
    s = get_settings()
    return build_router(s.answer_provider, s.fallback_provider, analyzer=True)


@lru_cache
def vision_router() -> LlmRouter:
    # 문서 사진 해설은 예선 설계대로 Gemini 멀티모달이 기본, Claude 가 대체.
    return build_router("gemini", "claude")


@lru_cache
def embedder() -> Embedder | None:
    s = get_settings()
    if not s.gemini_api_key:
        return None
    from woori.llm.gemini import GeminiEmbedder

    return GeminiEmbedder(s.gemini_api_key, s.embed_model, s.embed_dim)

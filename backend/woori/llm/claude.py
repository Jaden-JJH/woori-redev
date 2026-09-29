import json

import anthropic

from woori.llm.base import JsonRequest, JsonResult, LlmError, LlmRefused

# 안전 분류기가 요청을 거절하면 서버가 권장 모델로 다시 실행한다(Opus 5, Fable 계열 전용).
FALLBACK_BETA = "server-side-fallback-2026-07-01"


def _family(model: str) -> str:
    if model.startswith("claude-haiku"):
        return "haiku"
    if model.startswith("claude-sonnet"):
        return "sonnet"
    return "opus"


class ClaudeProvider:
    name = "claude"

    def __init__(self, api_key: str, model: str, timeout: float = 45.0):
        self.model = model
        self.family = _family(model)
        self._client = anthropic.Anthropic(api_key=api_key, timeout=timeout, max_retries=2)

    def _params(self, req: JsonRequest) -> dict:
        content: list[dict] = [
            {"type": "image", "source": {"type": "base64", "media_type": img.media_type, "data": img.b64}}
            for img in req.images
        ]
        content.append({"type": "text", "text": req.user})
        params: dict = {
            "model": self.model,
            "max_tokens": req.max_tokens,
            # 시스템 지시문은 요청마다 같으므로 캐시한다.
            "system": [{"type": "text", "text": req.system, "cache_control": {"type": "ephemeral"}}],
            "messages": [{"role": "user", "content": content}],
            "output_config": {"format": {"type": "json_schema", "schema": req.schema}},
        }
        if self.family == "sonnet":
            # 속도 우선: 사고 과정을 끄고 effort 를 낮춘다.
            params["thinking"] = {"type": "disabled"}
            params["output_config"]["effort"] = "low"
        elif self.family == "opus":
            params["output_config"]["effort"] = req.effort
        # haiku 4.5 는 effort 를 받지 않는다.
        return params

    def generate_json(self, req: JsonRequest) -> JsonResult:
        params = self._params(req)
        try:
            if self.family == "opus":
                resp = self._client.beta.messages.create(betas=[FALLBACK_BETA], fallbacks="default", **params)
            else:
                resp = self._client.messages.create(**params)
        except anthropic.RateLimitError as e:
            raise LlmError(f"claude rate limited: {e}") from e
        except anthropic.APIStatusError as e:
            raise LlmError(f"claude status {e.status_code}: {e.message}") from e
        except anthropic.APIConnectionError as e:
            raise LlmError(f"claude connection: {e}") from e

        if resp.stop_reason == "refusal":
            raise LlmRefused("claude refused the request")
        if resp.stop_reason == "max_tokens":
            raise LlmError("claude output truncated (max_tokens)")
        text = next((b.text for b in resp.content if b.type == "text"), None)
        if text is None:
            raise LlmError("claude returned no text block")
        usage = {
            "input_tokens": resp.usage.input_tokens,
            "output_tokens": resp.usage.output_tokens,
            "cache_read_input_tokens": getattr(resp.usage, "cache_read_input_tokens", 0) or 0,
        }
        return JsonResult(data=json.loads(text), model=resp.model, provider=self.name, usage=usage)

import json

import anthropic

from woori.llm.base import JsonRequest, JsonResult, LlmError, LlmRefused

# 안전 분류기가 요청을 거절하면 서버가 권장 모델로 다시 실행한다.
FALLBACK_BETA = "server-side-fallback-2026-07-01"


class ClaudeProvider:
    name = "claude"

    def __init__(self, api_key: str, model: str, timeout: float = 45.0):
        self.model = model
        self._client = anthropic.Anthropic(api_key=api_key, timeout=timeout, max_retries=2)

    def generate_json(self, req: JsonRequest) -> JsonResult:
        content: list[dict] = [
            {"type": "image", "source": {"type": "base64", "media_type": img.media_type, "data": img.b64}}
            for img in req.images
        ]
        content.append({"type": "text", "text": req.user})
        try:
            resp = self._client.beta.messages.create(
                model=self.model,
                max_tokens=req.max_tokens,
                betas=[FALLBACK_BETA],
                fallbacks="default",
                # 시스템 지시문은 요청마다 같으므로 캐시한다.
                system=[{"type": "text", "text": req.system, "cache_control": {"type": "ephemeral"}}],
                messages=[{"role": "user", "content": content}],
                output_config={
                    "format": {"type": "json_schema", "schema": req.schema},
                    "effort": req.effort,
                },
            )
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

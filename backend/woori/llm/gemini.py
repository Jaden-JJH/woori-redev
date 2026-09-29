import json

from google import genai
from google.genai import errors, types

from woori.llm.base import JsonRequest, JsonResult, LlmError, LlmRefused


class GeminiProvider:
    name = "gemini"

    def __init__(self, api_key: str, model: str):
        self.model = model
        self._client = genai.Client(api_key=api_key)

    def generate_json(self, req: JsonRequest) -> JsonResult:
        parts: list = [types.Part.from_bytes(data=img.data, mime_type=img.media_type) for img in req.images]
        parts.append(req.user)
        try:
            resp = self._client.models.generate_content(
                model=self.model,
                contents=parts,
                config=types.GenerateContentConfig(
                    system_instruction=req.system,
                    response_mime_type="application/json",
                    response_json_schema=req.schema,
                    temperature=0.1,
                    max_output_tokens=req.max_tokens,
                ),
            )
        except errors.APIError as e:
            raise LlmError(f"gemini {e.code}: {e.message}") from e
        if not resp.candidates:
            raise LlmRefused("gemini returned no candidates (blocked)")
        finish = resp.candidates[0].finish_reason
        if finish is not None and finish.name in ("SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST"):
            raise LlmRefused(f"gemini blocked: {finish.name}")
        if not resp.text:
            raise LlmError("gemini returned empty text")
        meta = resp.usage_metadata
        usage = {
            "input_tokens": getattr(meta, "prompt_token_count", 0) or 0,
            "output_tokens": getattr(meta, "candidates_token_count", 0) or 0,
        }
        return JsonResult(data=json.loads(resp.text), model=self.model, provider=self.name, usage=usage)


class GeminiEmbedder:
    def __init__(self, api_key: str, model: str, dim: int):
        self.model = model
        self.dim = dim
        self._client = genai.Client(api_key=api_key)

    def embed(self, texts: list[str], *, task: str) -> list[list[float]]:
        """task: 'document' | 'query'"""
        task_type = "RETRIEVAL_DOCUMENT" if task == "document" else "RETRIEVAL_QUERY"
        out: list[list[float]] = []
        for i in range(0, len(texts), 50):
            try:
                resp = self._client.models.embed_content(
                    model=self.model,
                    contents=texts[i : i + 50],
                    config=types.EmbedContentConfig(task_type=task_type, output_dimensionality=self.dim),
                )
            except errors.APIError as e:
                raise LlmError(f"gemini embed {e.code}: {e.message}") from e
            out.extend(_l2(e.values) for e in resp.embeddings)
        return out


def _l2(v: list[float]) -> list[float]:
    # 768 차원처럼 잘라 쓴 임베딩은 정규화해야 코사인 거리가 의미를 가진다.
    n = sum(x * x for x in v) ** 0.5 or 1.0
    return [x / n for x in v]

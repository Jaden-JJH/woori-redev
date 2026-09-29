import base64
import hashlib
import json
from dataclasses import dataclass, field
from typing import Protocol


class LlmError(RuntimeError):
    """공급자 호출 실패 (네트워크, 한도, 서버 오류)."""


class LlmRefused(LlmError):
    """모델 또는 안전 분류기가 요청을 거절했다."""


@dataclass(frozen=True)
class ImageInput:
    data: bytes
    media_type: str

    @property
    def b64(self) -> str:
        return base64.standard_b64encode(self.data).decode("ascii")


@dataclass(frozen=True)
class JsonRequest:
    """공급자 중립 요청. system 은 고정 지시문, user 는 이번 요청의 자료와 질문."""

    task: str
    system: str
    user: str
    schema: dict
    images: tuple[ImageInput, ...] = ()
    effort: str = "medium"
    max_tokens: int = 4096

    def fingerprint(self) -> str:
        h = hashlib.sha256()
        h.update(json.dumps([self.task, self.system, self.user, self.schema], ensure_ascii=False).encode())
        for img in self.images:
            h.update(hashlib.sha256(img.data).digest())
        return h.hexdigest()


@dataclass
class JsonResult:
    data: dict
    model: str
    provider: str
    usage: dict = field(default_factory=dict)


class JsonProvider(Protocol):
    name: str

    def generate_json(self, req: JsonRequest) -> JsonResult: ...


class Embedder(Protocol):
    model: str

    def embed(self, texts: list[str], *, task: str) -> list[list[float]]: ...

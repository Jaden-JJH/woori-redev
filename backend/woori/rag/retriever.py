"""하이브리드 검색: BM25(형태소) + 벡터(pgvector) → RRF 결합.

선택한 구역은 하드 필터다. 법령 청크(zone_ids 가 NULL)는 모든 구역에 공통으로 검색된다.
"""

import json
import logging
import threading
from dataclasses import dataclass, field

from woori.config import get_settings
from woori.db import connection
from woori.llm.base import LlmError
from woori.llm.router import embedder
from woori.rag.bm25 import BM25Index
from woori.rag.tokenizer import tokenize

log = logging.getLogger(__name__)


@dataclass
class Chunk:
    id: int
    source_type: str
    source_label: str
    source_url: str | None
    header: str
    body: str
    zone_ids: list[str] | None
    resident_types: list[str] | None


@dataclass
class Hit:
    chunk: Chunk
    rrf: float
    bm25_rank: int | None = None
    bm25_score: float | None = None
    vector_rank: int | None = None
    coverage: float = 0.0


@dataclass
class RetrievalResult:
    hits: list[Hit]
    query_tokens: list[str]
    known_ratio: float
    top_coverage: float
    agree: int
    vector_used: bool
    signals: dict = field(default_factory=dict)


class Retriever:
    def __init__(self):
        self._lock = threading.Lock()
        self._loaded_sig: tuple | None = None
        self.chunks: dict[int, Chunk] = {}
        self.index: BM25Index | None = None

    def _signature(self, conn) -> tuple:
        r = conn.execute("SELECT count(*) AS n, coalesce(max(id),0) AS m, md5(string_agg(content_hash, '' ORDER BY id)) AS h FROM chunk").fetchone()
        return (r["n"], r["m"], r["h"])

    def ensure_loaded(self) -> None:
        with connection() as conn:
            sig = self._signature(conn)
            if sig == self._loaded_sig:
                return
            with self._lock:
                rows = conn.execute(
                    "SELECT id, source_type, source_label, source_url, header, body, zone_ids, resident_types FROM chunk"
                ).fetchall()
                self.chunks = {r["id"]: Chunk(**r) for r in rows}
                # 머리말(조문 제목, 고시 제목)은 두 번 색인해 가중치를 준다.
                self.index = BM25Index(
                    {cid: tokenize(f"{c.header}\n{c.header}\n{c.body}") for cid, c in self.chunks.items()}
                )
                self._loaded_sig = sig
                log.info("bm25 index loaded: %d chunks", len(self.chunks))

    def _allowed(self, zone_id: str) -> set[int]:
        return {
            cid for cid, c in self.chunks.items() if c.zone_ids is None or (c.zone_ids and zone_id in c.zone_ids)
        }

    def _vector_search(self, query: str, zone_id: str, top_k: int) -> list[int] | None:
        emb = embedder()
        if emb is None:
            return None
        try:
            vec = emb.embed([query], task="query")[0]
        except LlmError as e:
            log.warning("query embedding failed: %s", e)
            return None
        with connection() as conn:
            rows = conn.execute(
                """SELECT id FROM chunk
                   WHERE embedding IS NOT NULL AND (zone_ids IS NULL OR %s = ANY(zone_ids))
                   ORDER BY embedding <=> %s::vector LIMIT %s""",
                (zone_id, json.dumps(vec), top_k),
            ).fetchall()
        return [r["id"] for r in rows]

    @staticmethod
    def _diversify(ranked: list[Hit], per_source: int = 2) -> list[Hit]:
        """같은 조문, 같은 고시의 청크는 최대 2개까지만 문맥에 넣는다."""
        seen: dict[str, int] = {}
        out: list[Hit] = []
        for h in ranked:
            n = seen.get(h.chunk.source_label, 0)
            if n < per_source:
                out.append(h)
                seen[h.chunk.source_label] = n + 1
        return out

    def search(self, query: str, zone_id: str, extra_terms: list[str] | None = None) -> RetrievalResult:
        s = get_settings()
        self.ensure_loaded()
        assert self.index is not None
        q_tokens = tokenize(query) + [t for term in (extra_terms or []) for t in tokenize(term)]
        allowed = self._allowed(zone_id)
        bm = self.index.search(q_tokens, allowed, s.bm25_top_k)
        vec_ids = self._vector_search(query, zone_id, s.vector_top_k)

        fused: dict[int, Hit] = {}
        for rank, sc in enumerate(bm, start=1):
            h = fused.setdefault(sc.doc_id, Hit(self.chunks[sc.doc_id], 0.0))
            h.bm25_rank, h.bm25_score = rank, sc.score
            h.rrf += 1.0 / (s.rrf_k + rank)
        for rank, cid in enumerate(vec_ids or [], start=1):
            if cid not in self.chunks:
                continue
            h = fused.setdefault(cid, Hit(self.chunks[cid], 0.0))
            h.vector_rank = rank
            h.rrf += 1.0 / (s.rrf_k + rank)
        ranked = self._diversify(sorted(fused.values(), key=lambda h: h.rrf, reverse=True))
        hits = ranked[: s.context_top_k]
        # 구역 고시 자리 보장: 법령이 많아 구역 고시가 밀려나도 관련 고시 상위 2개는 문맥에 넣는다.
        zone_notices = [h for h in ranked if h.chunk.source_type == "notice"][:2]
        for h in zone_notices:
            if h not in hits:
                hits = [*hits[:-1], h]
        for h in hits:
            h.coverage = self.index.coverage(q_tokens, h.chunk.id)

        agree = len({x.doc_id for x in bm[:10]} & set((vec_ids or [])[:10]))
        top_cov = max((h.coverage for h in hits), default=0.0)
        return RetrievalResult(
            hits=hits,
            query_tokens=q_tokens,
            known_ratio=self.index.known_ratio(q_tokens),
            top_coverage=top_cov,
            agree=agree,
            vector_used=vec_ids is not None,
            signals={
                "top_rrf": round(hits[0].rrf, 4) if hits else 0.0,
                "top_bm25": round(bm[0].score, 2) if bm else 0.0,
                "top_coverage": round(top_cov, 3),
                "known_ratio": round(self.index.known_ratio(q_tokens), 3),
                "agree": agree,
                "vector_used": vec_ids is not None,
            },
        )


_retriever: Retriever | None = None


def get_retriever() -> Retriever:
    global _retriever
    if _retriever is None:
        _retriever = Retriever()
    return _retriever

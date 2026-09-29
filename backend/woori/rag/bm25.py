"""메모리 BM25 (Okapi). 코퍼스가 수천 청크 규모라 역색인 하나로 충분하다."""

import math
from collections import Counter
from dataclasses import dataclass


@dataclass
class Scored:
    doc_id: int
    score: float


class BM25Index:
    def __init__(self, docs: dict[int, list[str]], k1: float = 1.2, b: float = 0.75):
        self.k1, self.b = k1, b
        self.doc_len = {d: len(toks) for d, toks in docs.items()}
        self.N = len(docs)
        self.avgdl = (sum(self.doc_len.values()) / self.N) if self.N else 0.0
        self.postings: dict[str, dict[int, int]] = {}
        for d, toks in docs.items():
            for term, tf in Counter(toks).items():
                self.postings.setdefault(term, {})[d] = tf
        self.idf = {
            t: math.log(1 + (self.N - len(p) + 0.5) / (len(p) + 0.5)) for t, p in self.postings.items()
        }

    def search(self, query_tokens: list[str], allowed: set[int] | None = None, top_k: int = 30) -> list[Scored]:
        scores: dict[int, float] = {}
        for term in set(query_tokens):
            posting = self.postings.get(term)
            if not posting:
                continue
            idf = self.idf[term]
            for d, tf in posting.items():
                if allowed is not None and d not in allowed:
                    continue
                norm = tf + self.k1 * (1 - self.b + self.b * self.doc_len[d] / self.avgdl)
                scores[d] = scores.get(d, 0.0) + idf * tf * (self.k1 + 1) / norm
        ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:top_k]
        return [Scored(d, s) for d, s in ranked]

    def coverage(self, query_tokens: list[str], doc_id: int) -> float:
        """질의 색인어의 idf 가중치 중 문서가 담고 있는 비율(0~1). 코퍼스 크기와 무관한 근거 신호.

        코퍼스에 없는 색인어는 가장 드문 단어의 idf 로 분모에 넣는다. 정비사업과 무관한 말이 많은 질문일수록 낮아진다.
        """
        terms = set(query_tokens)
        if not terms or not self.idf:
            return 0.0
        max_idf = max(self.idf.values())
        total = sum(self.idf.get(t, max_idf) for t in terms)
        hit = sum(self.idf[t] for t in terms if t in self.idf and doc_id in self.postings[t])
        return hit / total

    def known_ratio(self, query_tokens: list[str]) -> float:
        """질의 색인어 중 코퍼스 어휘에 있는 비율. 정비사업과 무관한 질문이면 낮다."""
        terms = set(query_tokens)
        return (sum(1 for t in terms if t in self.idf) / len(terms)) if terms else 0.0

# -*- coding: utf-8 -*-
"""
우리동네 재개발 비서 — 검색·인용 파이프라인 PoC
코퍼스: 성남시 고시공고 게시판에서 2026.8.25 실제 수집한 재개발 고시 6건
단계: 질의 → BM25 하이브리드(문자 bigram+어절) 검색 → 신뢰 게이트 → 출처 인용
※ 답변 '생성'(LLM) 단계는 API 연동 후 수행. 본 PoC는 검색·인용·거부 게이트 검증용.
"""
import json, math, re

def tokenize(text):
    """한국어 간이 토크나이저: 어절 + 문자 bigram (형태소 분석기 없이 BM25용)"""
    words = re.findall(r"[가-힣A-Za-z0-9]+", text)
    bigrams = [w[i:i+2] for w in words for i in range(len(w)-1)]
    return words + bigrams

class BM25:
    def __init__(self, docs, k1=1.5, b=0.75):
        self.docs = [tokenize(d) for d in docs]
        self.N = len(docs); self.k1, self.b = k1, b
        self.avgdl = sum(len(d) for d in self.docs) / self.N
        self.df = {}
        for d in self.docs:
            for t in set(d): self.df[t] = self.df.get(t, 0) + 1
    def score(self, query, idx):
        q = tokenize(query); d = self.docs[idx]; dl = len(d); s = 0.0
        for t in set(q):
            if t not in self.df: continue
            tf = d.count(t)
            idf = math.log(1 + (self.N - self.df[t] + 0.5) / (self.df[t] + 0.5))
            s += idf * tf * (self.k1+1) / (tf + self.k1*(1 - self.b + self.b*dl/self.avgdl))
        return s

GATE_THRESHOLD = 6.0  # 검색 신뢰 게이트: 미만이면 답변 거부

corpus = json.load(open("corpus.json", encoding="utf-8"))
bm25 = BM25([f"{c['zone']} {c['title']} {c['body']}" for c in corpus])

def ask(query):
    scored = sorted(((bm25.score(query, i), i) for i in range(len(corpus))), reverse=True)
    top_score, top_i = scored[0]
    print(f"Q. {query}")
    if top_score < GATE_THRESHOLD:
        print(f"   -> [신뢰 게이트: 거부] 최고 점수 {top_score:.1f} < 임계값 {GATE_THRESHOLD}")
        print( "   -> 근거 문서 없음. 답변을 생성하지 않고 공식 창구(성남시 재개발과)를 안내합니다.")
    else:
        c = corpus[top_i]
        clause = re.search(r"「[^」]+」\s*제?[\d조제항호,\s]+[조호항]", c["body"])
        print(f"   -> [검색 성공] 점수 {top_score:.1f} | 근거 문서: {c['notice_no']} ({c['date']})")
        print(f"      제목: {c['title']}")
        print(f"      태깅: zone={c['zone']} / stage={c['stage']} / 담당={c['dept']}")
        print(f"      인용 조항: {clause.group(0) if clause else '본문 참조'}")
    print()

if __name__ == "__main__":
    print("=== 검색·인용 파이프라인 PoC 실행 (코퍼스: 실제 성남시 고시 6건, 2026.8.25 수집) ===\n")
    ask("태평1구역 조합설립추진위원회가 승인됐나요?")
    ask("신흥1구역 사업시행계획 인가가 났나요?")
    ask("상대원3구역 사업시행자는 누구로 지정됐나요?")
    ask("재개발되면 우리 집 값이 얼마나 오를까요?")   # 경계 밖 질문 → 거부되어야 함

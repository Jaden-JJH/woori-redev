"""운영 CLI.

  woori seed              콘텐츠(content/*.yaml) 검증 후 DB 반영
  woori check             콘텐츠 검증만 (CI 용)
  woori notices [--full]  성남시 고시공고 수집
  woori laws              국가법령정보 API 로 법령 수집 (LAW_API_OC 필요)
  woori index             청크 생성과 임베딩
  woori all               seed → laws → notices → index
"""

import argparse
import json
import logging
import sys

from woori.config import get_settings
from woori.content.loader import ContentError, load_content
from woori.db import close_pool, connection
from woori.ingest import pipeline
from woori.llm.router import embedder


def _print(obj) -> None:
    print(json.dumps(obj, ensure_ascii=False, indent=1, default=str))


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    ap = argparse.ArgumentParser(prog="woori")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("seed")
    sub.add_parser("check")
    n = sub.add_parser("notices")
    n.add_argument("--full", action="store_true", help="이미 수집한 고시도 다시 받는다")
    sub.add_parser("laws")
    sub.add_parser("index")
    sub.add_parser("all")
    args = ap.parse_args(argv)

    try:
        content = load_content()
    except ContentError as e:
        print(e, file=sys.stderr)
        return 1
    if args.cmd == "check":
        print("content OK")
        return 0

    s = get_settings()
    try:
        return _run(args, content, s)
    finally:
        close_pool()


def _run(args, content, s) -> int:
    with connection() as conn:
        if args.cmd in ("seed", "all"):
            _print({"seed": pipeline.seed_content(conn, content)})
        if args.cmd in ("laws", "all"):
            if not s.law_api_oc:
                print("LAW_API_OC 가 설정되지 않았습니다 (.env)", file=sys.stderr)
                return 1
            _print({"laws": pipeline.ingest_laws(conn, s.law_api_oc)})
        if args.cmd in ("notices", "all"):
            _print({"notices": pipeline.ingest_notices(conn, content, full=getattr(args, "full", False))})
        if args.cmd in ("index", "all"):
            _print({"chunks": pipeline.store_chunks(conn, pipeline.build_chunks(conn, content))})
            _print({"embeddings": pipeline.embed_missing(conn, embedder())})
    return 0


if __name__ == "__main__":
    sys.exit(main())

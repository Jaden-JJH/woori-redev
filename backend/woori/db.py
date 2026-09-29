import atexit
from collections.abc import Iterator
from contextlib import contextmanager

import psycopg
from pgvector.psycopg import register_vector
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from woori.config import get_settings

_pool: ConnectionPool | None = None


def _configure(conn: psycopg.Connection) -> None:
    register_vector(conn)


def pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            get_settings().database_url,
            min_size=1,
            # Supabase session pooler 는 연결 수가 제한된다. Cloud Run 최대 2대 x 4 = 8 연결.
            max_size=4,
            kwargs={"row_factory": dict_row},
            configure=_configure,
            open=True,
        )
        atexit.register(close_pool)
    return _pool


@contextmanager
def connection() -> Iterator[psycopg.Connection]:
    with pool().connection() as conn:
        yield conn


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None

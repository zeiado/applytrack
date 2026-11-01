from sqlalchemy import BigInteger, Float, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from applytrack.models.base import Base


class RateLimitEvent(Base):
    """One counted event (such as a failed login) for DatabaseRateLimiter (ADR 0014).

    The key is hashed, so the table holds no emails or IP addresses. Rows older than a
    day are deleted by the worker's housekeeping; the longest window is an hour.
    """

    __tablename__ = "rate_limit_events"
    __table_args__ = (Index("ix_rate_limit_events_limiter_key_at", "limiter", "key_hash", "at"),)

    # BIGINT on PostgreSQL; SQLite only autoincrements a plain INTEGER primary key.
    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer(), "sqlite"), primary_key=True, autoincrement=True
    )
    limiter: Mapped[str] = mapped_column(String(40))  # which limit: "login_ip", ...
    key_hash: Mapped[str] = mapped_column(String(64))
    # Seconds since the epoch: the limiters' clocks count in seconds.
    at: Mapped[float] = mapped_column(Float, index=True)

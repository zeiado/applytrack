"""ORM models. Import every model module here so Alembic autogenerate can see it."""

from applytrack.models.base import Base

__all__ = ["Base"]

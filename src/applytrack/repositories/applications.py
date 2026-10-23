import uuid
from collections.abc import Iterator, Sequence
from datetime import date
from typing import Any

from sqlalchemy import ColumnElement, Select, func, select
from sqlalchemy.orm import Session

from applytrack.models import Application, ApplicationStatus, StatusChange
from applytrack.repositories.filters import ApplicationFilters

_SORT_COLUMNS = {
    "created_at": Application.created_at,
    "applied_on": Application.applied_on,
    "company": func.lower(Application.company),
}


class ApplicationRepository:
    """Every query is scoped to a user, so one user can never load another's data."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def get_for_user(
        self, user_id: uuid.UUID, application_id: uuid.UUID, *, for_update: bool = False
    ) -> Application | None:
        """Load one application. `for_update` locks the row until commit (PostgreSQL),
        so two concurrent status changes can't both read the same old status."""
        query = select(Application).where(
            Application.id == application_id, Application.user_id == user_id
        )
        if for_update:
            query = query.with_for_update()
        return self.session.scalar(query)

    def add_status_change(self, change: StatusChange) -> None:
        self.session.add(change)
        self.session.flush()

    def history(self, application_id: uuid.UUID) -> list[StatusChange]:
        return list(
            self.session.scalars(
                select(StatusChange)
                .where(StatusChange.application_id == application_id)
                .order_by(StatusChange.id)
            )
        )

    def list_for_user(
        self,
        user_id: uuid.UUID,
        filters: ApplicationFilters,
        *,
        sort: str,
        limit: int,
        offset: int,
    ) -> tuple[list[Application], int]:
        """Return one page of matching applications and the total number of matches."""
        query = self._filtered(user_id, filters)
        total = self.session.scalar(select(func.count()).select_from(query.subquery())) or 0
        items = self.session.scalars(
            query.order_by(*self._order_by(sort)).limit(limit).offset(offset)
        ).all()
        return list(items), total

    def iter_for_user(
        self, user_id: uuid.UUID, filters: ApplicationFilters, *, sort: str, batch_size: int = 500
    ) -> Iterator[Application]:
        """Every matching application, fetched `batch_size` rows at a time (a server-side
        cursor on PostgreSQL), so exporting thousands of rows doesn't load them all at once."""
        query = (
            self._filtered(user_id, filters)
            .order_by(*self._order_by(sort))
            .execution_options(yield_per=batch_size)
        )
        yield from self.session.scalars(query)

    def due_for_follow_up(
        self,
        user_id: uuid.UUID,
        *,
        on_or_before: date,
        exclude_statuses: Sequence[ApplicationStatus],
        limit: int,
        offset: int,
    ) -> tuple[list[Application], int]:
        """Applications with a follow-up date on or before `on_or_before`, most overdue first."""
        query = select(Application).where(
            Application.user_id == user_id,
            Application.follow_up_on.is_not(None),
            Application.follow_up_on <= on_or_before,
            Application.status.not_in(exclude_statuses),
        )
        total = self.session.scalar(select(func.count()).select_from(query.subquery())) or 0
        items = self.session.scalars(
            query.order_by(
                Application.follow_up_on, func.lower(Application.company), Application.id
            )
            .limit(limit)
            .offset(offset)
        ).all()
        return list(items), total

    def count_for_user(self, user_id: uuid.UUID) -> int:
        query = select(func.count()).select_from(Application).where(Application.user_id == user_id)
        return self.session.scalar(query) or 0

    def add(self, application: Application) -> Application:
        self.session.add(application)
        self.session.flush()
        return application

    def delete(self, application: Application) -> None:
        self.session.delete(application)
        self.session.flush()

    @staticmethod
    def _filtered(user_id: uuid.UUID, filters: ApplicationFilters) -> Select[Application]:
        query = select(Application).where(Application.user_id == user_id)
        if filters.statuses:
            query = query.where(Application.status.in_(filters.statuses))
        if filters.sources:
            query = query.where(Application.source.in_(filters.sources))
        if filters.company:
            # autoescape: a search for "50%" matches the text "50%", not "50 then anything".
            query = query.where(Application.company.icontains(filters.company, autoescape=True))
        return query

    @staticmethod
    def _order_by(sort: str) -> list[ColumnElement[Any]]:
        descending = sort.startswith("-")
        column = _SORT_COLUMNS[sort.removeprefix("-")]
        ordered = column.desc() if descending else column.asc()
        # NULLS LAST in both directions (databases disagree on the default), then id
        # as a tie-breaker so pages never overlap or skip rows.
        return [ordered.nulls_last(), Application.id.asc()]

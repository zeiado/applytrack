from pydantic import BaseModel, Field

MAX_PAGE_SIZE = 100


class Page[T](BaseModel):
    items: list[T]
    total: int = Field(description="Number of items matching the filters, across all pages")
    limit: int
    offset: int

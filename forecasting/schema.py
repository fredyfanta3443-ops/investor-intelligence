from typing import Literal

from pydantic import BaseModel

Tier = Literal["basic", "statistical", "ml", "deep_learning"]

KPI_FIELDS = (
    "revenue",
    "net_income",
    "operating_income",
    "cash_flow",
    "total_assets",
    "total_liabilities",
)


class ForecastPoint(BaseModel):
    year: int
    value: float
    kind: Literal["historical", "forecast"]


class ForecastResult(BaseModel):
    company: str
    kpi: str
    model: Tier
    points: list[ForecastPoint]
    note: str | None = None


class InsufficientDataError(Exception):
    """Raised when a tier doesn't have enough historical points to run."""

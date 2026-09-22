import re

from database.metrics import get_metrics_history
from forecasting.schema import ForecastPoint


def parse_numeric(value) -> float | None:
    """
    Coerce a KPI value from the database into a float.

    Values come from LLM extraction and may be a bare number, a numeric
    string, or (rarely) a string with currency formatting like "$391,035"
    or "(1,234)" for a negative. Returns None if it can't be parsed.
    """
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if not isinstance(value, str):
        return None

    text = value.strip()
    if not text:
        return None

    negative = text.startswith("(") and text.endswith(")")
    cleaned = re.sub(r"[^0-9.\-]", "", text)
    if not cleaned or cleaned in ("-", "."):
        return None

    try:
        num = float(cleaned)
    except ValueError:
        return None

    return -abs(num) if negative else num


def get_kpi_series(company: str, kpi: str) -> list[ForecastPoint]:
    """
    Fetch a company's historical values for one KPI field, as a
    chronologically sorted list of (year, value) points. Years with a
    missing/unparseable value for this KPI are skipped rather than
    included as zero — a gap shouldn't silently become a data point.

    Args:
        company: Company name (matches the `company` field in Cosmos DB).
        kpi: One of forecasting.schema.KPI_FIELDS.
    """
    rows = get_metrics_history(company=company)

    points: list[ForecastPoint] = []
    for row in rows:
        value = parse_numeric(row.get(kpi))
        if value is None:
            continue
        try:
            year = int(row["year"])
        except (TypeError, ValueError):
            continue
        points.append(ForecastPoint(year=year, value=value, kind="historical"))

    points.sort(key=lambda p: p.year)
    return points

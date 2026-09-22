import numpy as np

from forecasting.schema import ForecastPoint, ForecastResult, InsufficientDataError

MIN_POINTS = 2


def forecast_basic(
    company: str,
    kpi: str,
    history: list[ForecastPoint],
    horizon: int = 3
) -> ForecastResult:
    """
    Tier 1: naive linear trend extrapolation.

    Fits a degree-1 polynomial (a straight line) through the historical
    points and projects it forward. This is the simplest possible
    forecast — no seasonality, no mean-reversion, just "continue the
    slope" — so it's a reasonable floor to compare fancier tiers against,
    not a serious prediction on its own.
    """
    if len(history) < MIN_POINTS:
        raise InsufficientDataError(
            f"Basic trend forecasting needs at least {MIN_POINTS} historical "
            f"points, got {len(history)}."
        )

    years = np.array([p.year for p in history], dtype=float)
    values = np.array([p.value for p in history], dtype=float)

    slope, intercept = np.polyfit(years, values, deg=1)

    last_year = int(years.max())
    forecast_points = [
        ForecastPoint(
            year=last_year + step,
            value=float(slope * (last_year + step) + intercept),
            kind="forecast"
        )
        for step in range(1, horizon + 1)
    ]

    return ForecastResult(
        company=company,
        kpi=kpi,
        model="basic",
        points=history + forecast_points,
        note="Linear trend extrapolation (least-squares fit through historical values)."
    )

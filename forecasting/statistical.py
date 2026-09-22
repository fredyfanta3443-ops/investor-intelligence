import warnings

import numpy as np
from statsmodels.tsa.holtwinters import Holt

from forecasting.schema import ForecastPoint, ForecastResult, InsufficientDataError

MIN_POINTS = 3


def forecast_statistical(
    company: str,
    kpi: str,
    history: list[ForecastPoint],
    horizon: int = 3
) -> ForecastResult:
    """
    Tier 2: Holt's linear exponential smoothing.

    Unlike the basic tier's equal-weighted least-squares line, Holt's
    method weights recent observations more heavily when estimating the
    level and trend, so it reacts faster to a recent inflection instead
    of averaging it out over the whole history. Full ARIMA was
    considered but needs materially more data than a 5-year 10-K series
    provides to fit reliably (order selection and stationarity checks
    get unstable below ~8-10 points) — Holt is the right-sized
    statistical model for this data volume.
    """
    if len(history) < MIN_POINTS:
        raise InsufficientDataError(
            f"Statistical forecasting needs at least {MIN_POINTS} historical "
            f"points, got {len(history)}."
        )

    years = [p.year for p in history]
    values = np.array([p.value for p in history], dtype=float)

    # Holt's method assumes evenly-spaced observations; 10-K filings are
    # annual, so index by position rather than the actual year values.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        model = Holt(values, initialization_method="estimated").fit(optimized=True)
        projected = model.forecast(horizon)

    last_year = max(years)
    forecast_points = [
        ForecastPoint(year=last_year + step, value=float(projected[step - 1]), kind="forecast")
        for step in range(1, horizon + 1)
    ]

    return ForecastResult(
        company=company,
        kpi=kpi,
        model="statistical",
        points=history + forecast_points,
        note="Holt's linear exponential smoothing (recency-weighted level + trend)."
    )

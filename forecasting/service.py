from forecasting.basic import forecast_basic
from forecasting.data import get_kpi_series
from forecasting.deep_learning import forecast_deep_learning
from forecasting.ml import forecast_ml
from forecasting.schema import ForecastResult, InsufficientDataError, Tier
from forecasting.statistical import forecast_statistical

_TIER_FUNCS = {
    "basic": forecast_basic,
    "statistical": forecast_statistical,
    "ml": forecast_ml,
    "deep_learning": forecast_deep_learning,
}


def run_forecast(
    company: str,
    kpi: str,
    tier: Tier,
    horizon: int = 3
) -> ForecastResult:
    """
    Fetch a company's historical series for one KPI and run the requested
    forecasting tier against it.

    Raises:
        InsufficientDataError: not enough historical points for this tier.
        ValueError: unknown tier or KPI, or no historical data at all.
    """
    if tier not in _TIER_FUNCS:
        raise ValueError(f"Unknown forecasting tier: {tier!r}")

    history = get_kpi_series(company=company, kpi=kpi)
    if not history:
        raise InsufficientDataError(
            f"No historical '{kpi}' values found for {company!r}."
        )

    return _TIER_FUNCS[tier](company=company, kpi=kpi, history=history, horizon=horizon)

import numpy as np
from sklearn.ensemble import RandomForestRegressor

from forecasting.schema import ForecastPoint, ForecastResult, InsufficientDataError

MIN_POINTS = 4


def forecast_ml(
    company: str,
    kpi: str,
    history: list[ForecastPoint],
    horizon: int = 3
) -> ForecastResult:
    """
    Tier 3: Random Forest regression over lag + time-index features.

    Training examples are built from consecutive pairs in the history:
    X = [time_index, previous_value] -> y = current_value. With only a
    handful of years per company this gives just a few training rows, so
    the forest is kept small and shallow (regularized against
    overfitting an already-thin dataset). Future years are predicted
    recursively: each prediction becomes the "previous_value" input for
    the next step.

    Known, honest limitation: tree ensembles cannot extrapolate beyond
    the range of y-values seen during training — every leaf's prediction
    is bounded by training targets. So on a short, strongly trending
    series, this tier's multi-year-ahead forecast tends to flatten out
    rather than continue the trend the way tiers 1-2 do. That's expected
    behavior for this model family on this little data, not a bug —
    treat it as a plausibility check against the other tiers rather than
    a standalone trend forecast.
    """
    if len(history) < MIN_POINTS:
        raise InsufficientDataError(
            f"ML forecasting needs at least {MIN_POINTS} historical points "
            f"(to build lag-feature training pairs), got {len(history)}."
        )

    years = [p.year for p in history]
    values = [p.value for p in history]
    first_year = years[0]

    X_train = np.array([
        [years[i] - first_year, values[i - 1]]
        for i in range(1, len(history))
    ])
    y_train = np.array([values[i] for i in range(1, len(history))])

    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=3,
        random_state=0
    )
    model.fit(X_train, y_train)

    last_year = years[-1]
    last_value = values[-1]

    forecast_points = []
    for step in range(1, horizon + 1):
        time_index = last_year + step - first_year
        prediction = float(model.predict([[time_index, last_value]])[0])
        forecast_points.append(
            ForecastPoint(year=last_year + step, value=prediction, kind="forecast")
        )
        last_value = prediction

    return ForecastResult(
        company=company,
        kpi=kpi,
        model="ml",
        points=history + forecast_points,
        note=(
            "Random Forest regression (lag + time-index features), recursive "
            "multi-step. Tree ensembles can't extrapolate past the observed "
            "value range, so long-horizon predictions tend to flatten — "
            "compare against the basic/statistical tiers rather than reading "
            "this one alone."
        )
    )

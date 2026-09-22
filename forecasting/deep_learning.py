import numpy as np
import torch
from torch import nn

from forecasting.schema import ForecastPoint, ForecastResult, InsufficientDataError

# A 5-year-per-company 10-K series is nowhere near enough to train an LSTM
# meaningfully (this tier needs a real training set, not 4-5 points). This
# threshold is set honestly rather than lowered to make the tier "work" on
# our current data — with the currently-ingested history, calling this tier
# will correctly raise InsufficientDataError. It's implemented for real (not
# stubbed) so it's ready the moment enough history exists, e.g. after
# ingesting many more years, or pooling several companies' series.
MIN_POINTS = 8
WINDOW = 3


class _TinyLSTM(nn.Module):
    def __init__(self, hidden_size: int = 16):
        super().__init__()
        self.lstm = nn.LSTM(input_size=1, hidden_size=hidden_size, batch_first=True)
        self.head = nn.Linear(hidden_size, 1)

    def forward(self, x):
        out, _ = self.lstm(x)
        return self.head(out[:, -1, :])


def forecast_deep_learning(
    company: str,
    kpi: str,
    history: list[ForecastPoint],
    horizon: int = 3
) -> ForecastResult:
    """
    Tier 4 (stretch): a small single-layer LSTM over a sliding window of
    normalized values, trained from scratch per company/KPI, forecasting
    recursively. Genuinely trained (not a stub) — gated behind MIN_POINTS
    since a handful of annual data points can't teach a network anything
    beyond memorizing noise.
    """
    if len(history) < MIN_POINTS:
        raise InsufficientDataError(
            f"Deep learning forecasting needs at least {MIN_POINTS} historical "
            f"points to train on, got {len(history)}. This tier is a stretch "
            f"goal that requires substantially more history than the other "
            f"tiers — expected to be unavailable until far more years are "
            f"ingested."
        )

    values = np.array([p.value for p in history], dtype=np.float32)
    mean, std = values.mean(), values.std() or 1.0
    normalized = (values - mean) / std

    X, y = [], []
    for i in range(len(normalized) - WINDOW):
        X.append(normalized[i:i + WINDOW])
        y.append(normalized[i + WINDOW])
    X = torch.tensor(np.array(X)).unsqueeze(-1)  # (n, WINDOW, 1)
    y = torch.tensor(np.array(y)).unsqueeze(-1)  # (n, 1)

    model = _TinyLSTM()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
    loss_fn = nn.MSELoss()

    model.train()
    for _ in range(200):
        optimizer.zero_grad()
        loss = loss_fn(model(X), y)
        loss.backward()
        optimizer.step()

    model.eval()
    window = list(normalized[-WINDOW:])
    forecast_points = []
    last_year = history[-1].year

    with torch.no_grad():
        for step in range(1, horizon + 1):
            input_tensor = torch.tensor(np.array(window[-WINDOW:], dtype=np.float32)).view(1, WINDOW, 1)
            next_normalized = model(input_tensor).item()
            window.append(next_normalized)
            value = float(next_normalized * std + mean)
            forecast_points.append(
                ForecastPoint(year=last_year + step, value=value, kind="forecast")
            )

    return ForecastResult(
        company=company,
        kpi=kpi,
        model="deep_learning",
        points=history + forecast_points,
        note=(
            "Single-layer LSTM trained from scratch on this company's "
            "normalized history, recursive multi-step forecast."
        )
    )

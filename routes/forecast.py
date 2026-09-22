from fastapi import APIRouter, HTTPException, Query

from forecasting.schema import KPI_FIELDS, InsufficientDataError, Tier
from forecasting.service import run_forecast

router = APIRouter()


@router.get("/forecast")
def forecast(
    company: str,
    kpi: str = Query(..., description=f"One of: {', '.join(KPI_FIELDS)}"),
    model: Tier = Query("basic", description="basic | statistical | ml | deep_learning"),
    horizon: int = Query(3, ge=1, le=10)
):
    if kpi not in KPI_FIELDS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown kpi '{kpi}'. Must be one of: {', '.join(KPI_FIELDS)}"
        )

    try:
        result = run_forecast(company=company, kpi=kpi, tier=model, horizon=horizon)
    except InsufficientDataError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return result

from fastapi import APIRouter

from database.metrics import get_metrics

router = APIRouter()


@router.get("/metrics")
def metrics():
    """
    Latest KPI snapshot per company, for the dashboard.
    """
    return get_metrics()

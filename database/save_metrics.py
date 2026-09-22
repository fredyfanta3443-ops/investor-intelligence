from datetime import datetime, timezone

from database.cosmos_client import get_container


def save_metrics(
    company: str,
    year: int,
    metrics: dict
) -> None:
    """
    Save extracted financial metrics to Cosmos DB.

    Uses a deterministic id (`{company}_{year}`) and an upsert, so
    re-ingesting the same company/year overwrites the previous extraction
    instead of accumulating duplicate rows. This means the container
    naturally holds exactly one item per company/year — no "latest wins"
    dedup logic is needed when reading (see database/metrics.py).

    Args:
        company: Company name.
        year: Fiscal year.
        metrics: Extracted KPI dictionary (keys from the LLM's alias names
            or the FinancialMetrics field names — both are checked).
    """
    container = get_container()

    risk_factors = metrics.get("Top Risk Factors") or metrics.get("risk_factors") or []
    growth_drivers = metrics.get("Top Growth Drivers") or metrics.get("growth_drivers") or []

    item = {
        "id": f"{company}_{year}",
        "company": company,
        "year": str(year),
        "revenue": metrics.get("Revenue") or metrics.get("revenue"),
        "net_income": metrics.get("Net Income") or metrics.get("net_income"),
        "operating_income": metrics.get("Operating Income") or metrics.get("operating_income"),
        "cash_flow": metrics.get("Cash Flow from Operating Activities") or metrics.get("cash_flow"),
        "total_assets": metrics.get("Total Assets") or metrics.get("total_assets"),
        "total_liabilities": metrics.get("Total Liabilities") or metrics.get("total_liabilities"),
        "risk_factors": "\n".join(risk_factors) if isinstance(risk_factors, list) else risk_factors,
        "growth_drivers": "\n".join(growth_drivers) if isinstance(growth_drivers, list) else growth_drivers,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    container.upsert_item(item)

    print(f"Successfully saved metrics for {company} {year}")

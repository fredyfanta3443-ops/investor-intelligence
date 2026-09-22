from datetime import datetime, timezone

from azure.cosmos import exceptions

from database.cosmos_client import get_container


def save_metrics(
    company: str,
    year: int,
    metrics: dict
) -> None:
    """
    Save extracted financial metrics to Cosmos DB.

    Uses a deterministic id (`{company}_{year}`) and an upsert, so
    re-ingesting the same company/year updates the existing record
    instead of accumulating duplicate rows.

    Merges rather than blindly overwrites: a field is only replaced when
    the new extraction actually found something. RAG/PDF extraction can
    legitimately miss a field it found on a previous pass (retrieval is
    imperfect), and a value from a more reliable source (e.g. an SEC
    XBRL backfill) shouldn't get silently erased by a worse re-extraction
    of the same document. Any prior `source` tag is dropped on merge,
    since after mixing fields from two extractions the record's
    provenance is no longer uniform enough to label with one tag.

    Args:
        company: Company name.
        year: Fiscal year.
        metrics: Extracted KPI dictionary (keys from the LLM's alias names
            or the FinancialMetrics field names — both are checked).
    """
    container = get_container()

    risk_factors = metrics.get("Top Risk Factors") or metrics.get("risk_factors") or []
    growth_drivers = metrics.get("Top Growth Drivers") or metrics.get("growth_drivers") or []

    new_values = {
        "revenue": metrics.get("Revenue") or metrics.get("revenue"),
        "net_income": metrics.get("Net Income") or metrics.get("net_income"),
        "operating_income": metrics.get("Operating Income") or metrics.get("operating_income"),
        "cash_flow": metrics.get("Cash Flow from Operating Activities") or metrics.get("cash_flow"),
        "total_assets": metrics.get("Total Assets") or metrics.get("total_assets"),
        "total_liabilities": metrics.get("Total Liabilities") or metrics.get("total_liabilities"),
        "risk_factors": "\n".join(risk_factors) if isinstance(risk_factors, list) else risk_factors,
        "growth_drivers": "\n".join(growth_drivers) if isinstance(growth_drivers, list) else growth_drivers,
    }

    item_id = f"{company}_{year}"

    try:
        item = container.read_item(item=item_id, partition_key=company)
    except exceptions.CosmosResourceNotFoundError:
        item = {"id": item_id, "company": company, "year": str(year)}

    for key, value in new_values.items():
        if value not in (None, "", []):
            item[key] = value

    item.pop("source", None)
    item["updated_at"] = datetime.now(timezone.utc).isoformat()

    container.upsert_item(item)

    print(f"Successfully saved metrics for {company} {year}")

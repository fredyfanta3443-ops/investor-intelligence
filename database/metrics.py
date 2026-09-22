from azure.cosmos import exceptions

from database.cosmos_client import get_container

# Explicit field list keeps Cosmos's internal bookkeeping fields
# (_rid, _self, _etag, _attachments, _ts) out of API responses.
SELECT_FIELDS = (
    "c.id, c.company, c.year, c.revenue, c.net_income, c.operating_income, "
    "c.cash_flow, c.total_assets, c.total_liabilities, c.risk_factors, "
    "c.growth_drivers, c.updated_at"
)


def get_metrics() -> list[dict]:
    """
    Return every company's most recent fiscal-year KPI snapshot (for the
    dashboard). Since save_metrics() upserts one item per company/year,
    "most recent" here means the latest year on file per company.
    """
    container = get_container()

    items = list(
        container.query_items(
            query=f"SELECT {SELECT_FIELDS} FROM c",
            enable_cross_partition_query=True
        )
    )

    latest_by_company: dict[str, dict] = {}
    for item in items:
        company = item["company"]
        if company not in latest_by_company or item["year"] > latest_by_company[company]["year"]:
            latest_by_company[company] = item

    return sorted(latest_by_company.values(), key=lambda row: row["company"])


def get_metrics_history(company: str | None = None) -> list[dict]:
    """
    Return the full KPI time series (one item per year) for forecasting.

    Args:
        company: Restrict to a single company. Omit for all companies.
    """
    container = get_container()

    if company:
        items = list(
            container.query_items(
                query=f"SELECT {SELECT_FIELDS} FROM c WHERE c.company = @company",
                parameters=[{"name": "@company", "value": company}],
                partition_key=company
            )
        )
    else:
        items = list(
            container.query_items(
                query=f"SELECT {SELECT_FIELDS} FROM c",
                enable_cross_partition_query=True
            )
        )

    return sorted(items, key=lambda row: (row["company"], row["year"]))


def delete_metrics(company: str, year: str) -> bool:
    """
    Delete a single company/year KPI record.

    Returns:
        True if a record was deleted, False if it didn't exist.
    """
    container = get_container()

    try:
        container.delete_item(item=f"{company}_{year}", partition_key=company)
        return True
    except exceptions.CosmosResourceNotFoundError:
        return False

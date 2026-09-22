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


def delete_company(company: str) -> int:
    """
    Delete every KPI record for a company (all years), not just the year
    currently shown on the dashboard.

    The dashboard only ever displays a company's *latest* year, but the
    database can hold many years of history for forecasting. Deleting
    only that one visible year left older years intact, so the "deleted"
    company would silently reappear (showing its next-latest year) the
    next time the list refreshed - confusing, and not what "delete this
    company" implies from the UI. This clears the whole history so a
    delete-then-re-upload actually starts from nothing.

    Returns:
        Number of records deleted.
    """
    container = get_container()

    items = list(
        container.query_items(
            query="SELECT c.id FROM c WHERE c.company = @company",
            parameters=[{"name": "@company", "value": company}],
            partition_key=company
        )
    )

    for item in items:
        container.delete_item(item=item["id"], partition_key=company)

    return len(items)

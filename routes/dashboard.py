import os

from fastapi import APIRouter, HTTPException

from database.metrics import delete_company, get_metrics
from vectorstore.azure_ai_search import AzureAISearchVectorStore

router = APIRouter()


@router.get("/metrics")
def metrics():
    """
    Latest KPI snapshot per company, for the dashboard.
    """
    return get_metrics()


@router.delete("/metrics/{company}")
def delete_metric(company: str):
    """
    Delete a company's entire KPI history (every year, not just the one
    shown on the dashboard) and its vector-store chunks, so it can be
    cleanly re-uploaded from scratch afterward.
    """
    records_deleted = delete_company(company=company)
    if not records_deleted:
        raise HTTPException(status_code=404, detail=f"No records found for {company}")

    vector_store = AzureAISearchVectorStore(
        endpoint=os.getenv("AZURE_SEARCH_ENDPOINT"),
        api_key=os.getenv("AZURE_SEARCH_API_KEY"),
        index_name=os.getenv("AZURE_SEARCH_INDEX_NAME")
    )
    chunks_deleted = vector_store.delete_chunks(company=company)

    return {
        "message": f"Deleted {company} ({records_deleted} year(s) of records)",
        "records_deleted": records_deleted,
        "chunks_deleted": chunks_deleted
    }

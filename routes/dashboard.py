import os

from fastapi import APIRouter, HTTPException

from database.metrics import delete_metrics, get_metrics
from vectorstore.azure_ai_search import AzureAISearchVectorStore

router = APIRouter()


@router.get("/metrics")
def metrics():
    """
    Latest KPI snapshot per company, for the dashboard.
    """
    return get_metrics()


@router.delete("/metrics/{company}/{year}")
def delete_metric(company: str, year: str):
    """
    Delete a company/year's KPI record and its vector-store chunks, so it
    can be cleanly re-uploaded from scratch afterward.
    """
    deleted = delete_metrics(company=company, year=year)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"No record found for {company} {year}")

    vector_store = AzureAISearchVectorStore(
        endpoint=os.getenv("AZURE_SEARCH_ENDPOINT"),
        api_key=os.getenv("AZURE_SEARCH_API_KEY"),
        index_name=os.getenv("AZURE_SEARCH_INDEX_NAME")
    )
    chunks_deleted = vector_store.delete_chunks(company=company, year=year)

    return {
        "message": f"Deleted {company} {year}",
        "chunks_deleted": chunks_deleted
    }

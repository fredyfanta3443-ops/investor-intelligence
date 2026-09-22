import os
import shutil
from pathlib import Path

from fastapi import APIRouter, File, UploadFile

from ingestion.ingest_documents import ingest_document
from llm.embeddings import get_embeddings
from vectorstore.azure_ai_search import AzureAISearchVectorStore

router = APIRouter()


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...)
):
    """
    Upload a PDF annual report and run it through the full ingestion
    pipeline: convert to markdown, chunk, embed, upload to the vector
    store, extract KPIs, save to the database.
    """
    upload_dir = Path("data/raw_pdfs")
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_path = upload_dir / file.filename

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    embeddings = get_embeddings()

    vector_store = AzureAISearchVectorStore(
        endpoint=os.getenv("AZURE_SEARCH_ENDPOINT"),
        api_key=os.getenv("AZURE_SEARCH_API_KEY"),
        index_name=os.getenv("AZURE_SEARCH_INDEX_NAME")
    )

    ingest_document(
        pdf_path=str(file_path),
        embeddings=embeddings,
        vector_store=vector_store
    )

    return {
        "message": "Document uploaded successfully",
        "file_name": file.filename
    }

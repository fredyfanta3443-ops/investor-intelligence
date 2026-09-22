import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database.cosmos_client import get_container
from routes.chat import router as chat_router
from routes.dashboard import router as dashboard_router
from routes.health import router as health_router
from routes.ingestion import router as ingestion_router
from vectorstore.create_index import create_index

load_dotenv()

app = FastAPI(
    title="AI-Powered Investor Intelligence Platform"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.on_event("startup")
def startup_event():
    """
    Ensure the Cosmos DB container and Azure AI Search index exist.
    """
    get_container()

    try:
        create_index(
            endpoint=os.getenv("AZURE_SEARCH_ENDPOINT"),
            api_key=os.getenv("AZURE_SEARCH_API_KEY"),
            index_name=os.getenv("AZURE_SEARCH_INDEX_NAME"),
            embedding_dimensions=int(os.getenv("EMBEDDING_DIMENSIONS", "384"))
        )
    except Exception as e:
        print(f"Warning: Could not create/update vector index: {e}")


app.include_router(health_router)
app.include_router(dashboard_router, prefix="/api", tags=["Dashboard"])
app.include_router(ingestion_router, prefix="/api", tags=["Ingestion"])
app.include_router(chat_router, prefix="/api", tags=["Chat"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000
    )

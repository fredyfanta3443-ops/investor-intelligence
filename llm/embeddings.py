import os

from dotenv import load_dotenv
from langchain_huggingface import HuggingFaceEmbeddings

load_dotenv()

DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def get_embeddings() -> HuggingFaceEmbeddings:
    """
    Load the local HuggingFace embedding model used for semantic chunking
    and vector search. Runs on-device — no API key, no cost.
    """
    return HuggingFaceEmbeddings(
        model_name=os.getenv("EMBEDDING_MODEL", DEFAULT_MODEL)
    )

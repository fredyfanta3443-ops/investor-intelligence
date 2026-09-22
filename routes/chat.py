import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from llm.embeddings import get_embeddings
from llm.groq_llm import get_chat_completion
from vectorstore.azure_ai_search import AzureAISearchVectorStore, Retriever

router = APIRouter()


class ChatRequest(BaseModel):
    question: str
    company: str | None = None
    year: int | None = None


@router.post("/chat")
async def chat(request: ChatRequest):
    """
    RAG chatbot: retrieve relevant report chunks and answer the question
    grounded in that context.
    """
    try:
        vector_store = AzureAISearchVectorStore(
            endpoint=os.getenv("AZURE_SEARCH_ENDPOINT"),
            api_key=os.getenv("AZURE_SEARCH_API_KEY"),
            index_name=os.getenv("AZURE_SEARCH_INDEX_NAME")
        )
        retriever = Retriever(vector_store.client, embeddings=get_embeddings())

        docs = retriever.invoke(
            query=request.question,
            company=request.company,
            year=str(request.year) if request.year else None,
            top_k=8
        )
        context = "\n\n".join(doc.page_content[:1500] for doc in docs)

        prompt = (
            "You are an expert financial analyst. Use the following context "
            "from corporate annual reports to answer the user's question. "
            "If the context does not contain relevant information, say so "
            "clearly rather than guessing.\n\n"
            f"Context:\n{context}\n\n"
            f"User Question: {request.question}\n\n"
            "Answer:"
        )

        answer = get_chat_completion(prompt)

        return {"answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

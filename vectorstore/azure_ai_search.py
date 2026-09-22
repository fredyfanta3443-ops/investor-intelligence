import uuid
from types import SimpleNamespace

from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient


class AzureAISearchVectorStore:
    """Azure AI Search vector store."""

    def __init__(
        self,
        endpoint: str,
        api_key: str,
        index_name: str
    ) -> None:
        self.client = SearchClient(
            endpoint=endpoint,
            index_name=index_name,
            credential=AzureKeyCredential(api_key)
        )

    def upload_chunks(
        self,
        chunks,
        embeddings,
        company: str,
        year: str,
        source_file: str
    ) -> None:
        """
        Embed and upload document chunks to Azure AI Search.
        """
        documents = []

        for chunk in chunks:
            vector = embeddings.embed_query(chunk.page_content)

            documents.append(
                {
                    "id": str(uuid.uuid4()),
                    "company": company,
                    "year": year,
                    "source_file": source_file,
                    "content": chunk.page_content,
                    "content_vector": vector
                }
            )

        result = self.client.upload_documents(documents)

        uploaded = sum(item.succeeded for item in result)

        print(f"Uploaded {uploaded}/{len(documents)} chunks.")


class Retriever:
    """Wrapper around the Azure Search client for retrieving relevant chunks."""

    def __init__(self, client):
        self.client = client

    def invoke(
        self,
        query: str,
        company: str | None = None,
        year: int | str | None = None,
        top_k: int = 20
    ) -> list:
        """
        Retrieve relevant chunks from Azure AI Search, optionally filtered
        by company/year.

        Returns a list of SimpleNamespace objects with a `page_content`
        attribute, mirroring LangChain's Document interface closely enough
        for downstream RAG code to treat them the same way.
        """
        filter_expr = None

        if company and year:
            filter_expr = f"company eq '{company}' and year eq '{year}'"

        results = self.client.search(
            search_text=query,
            top=top_k,
            filter=filter_expr
        )

        return [
            SimpleNamespace(page_content=result.get("content", ""))
            for result in results
        ]

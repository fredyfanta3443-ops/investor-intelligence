import uuid
from types import SimpleNamespace

from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from azure.search.documents.models import VectorizedQuery


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
    """
    Wrapper around the Azure Search client for retrieving relevant chunks.

    Runs a hybrid search (keyword + vector) rather than keyword-only: the
    query is embedded and matched against content_vector, combined with
    a plain text match against content. Vector search is what makes
    semantic retrieval actually work — a keyword-only search on a query
    like "income statement, balance sheet, cash flow" tends to surface
    sections that happen to repeat those words (e.g. a table of contents)
    rather than the sections that actually contain the numbers.
    """

    def __init__(self, client, embeddings=None):
        self.client = client
        self.embeddings = embeddings

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

        vector_queries = None
        if self.embeddings is not None:
            vector_queries = [
                VectorizedQuery(
                    vector=self.embeddings.embed_query(query),
                    k_nearest_neighbors=top_k,
                    fields="content_vector"
                )
            ]

        results = self.client.search(
            search_text=query,
            vector_queries=vector_queries,
            top=top_k,
            filter=filter_expr
        )

        return [
            SimpleNamespace(page_content=result.get("content", ""))
            for result in results
        ]

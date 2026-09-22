import os

from azure.core.credentials import AzureKeyCredential
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    HnswAlgorithmConfiguration,
    SearchField,
    SearchFieldDataType,
    SearchIndex,
    SimpleField,
    VectorSearch,
    VectorSearchProfile
)
from dotenv import load_dotenv

load_dotenv()


def create_index(
    endpoint: str,
    api_key: str,
    index_name: str,
    embedding_dimensions: int = 384
) -> None:
    """
    Create (or update) the Azure AI Search index used to store document
    chunks and their embeddings.

    Args:
        endpoint: Azure AI Search endpoint.
        api_key: Azure AI Search API key.
        index_name: Index name.
        embedding_dimensions: Embedding vector size. Defaults to 384 to
            match the local sentence-transformers/all-MiniLM-L6-v2 model
            (the original used Azure OpenAI's ada-002 at 1536).
    """
    client = SearchIndexClient(
        endpoint=endpoint,
        credential=AzureKeyCredential(api_key)
    )

    fields = [
        SimpleField(name="id", type=SearchFieldDataType.String, key=True),
        SimpleField(name="company", type=SearchFieldDataType.String, filterable=True),
        SimpleField(name="year", type=SearchFieldDataType.String, filterable=True),
        SimpleField(name="source_file", type=SearchFieldDataType.String, filterable=True),
        SearchField(name="content", type=SearchFieldDataType.String, searchable=True),
        SearchField(
            name="content_vector",
            type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
            vector_search_dimensions=embedding_dimensions,
            vector_search_profile_name="vector-profile"
        )
    ]

    vector_search = VectorSearch(
        algorithms=[
            HnswAlgorithmConfiguration(name="hnsw-config")
        ],
        profiles=[
            VectorSearchProfile(
                name="vector-profile",
                algorithm_configuration_name="hnsw-config"
            )
        ]
    )

    index = SearchIndex(
        name=index_name,
        fields=fields,
        vector_search=vector_search
    )

    client.create_or_update_index(index)

    print(f"Index '{index_name}' created successfully.")


if __name__ == "__main__":
    create_index(
        endpoint=os.getenv("AZURE_SEARCH_ENDPOINT"),
        api_key=os.getenv("AZURE_SEARCH_API_KEY"),
        index_name=os.getenv("AZURE_SEARCH_INDEX_NAME"),
        embedding_dimensions=int(os.getenv("EMBEDDING_DIMENSIONS", "384"))
    )

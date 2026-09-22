import os

from azure.cosmos import ContainerProxy, CosmosClient, PartitionKey
from dotenv import load_dotenv

load_dotenv()


def get_cosmos_client() -> CosmosClient:
    """
    Create a Cosmos DB client from environment credentials.
    """
    return CosmosClient(
        url=os.getenv("COSMOS_ENDPOINT"),
        credential=os.getenv("COSMOS_KEY")
    )


def get_container() -> ContainerProxy:
    """
    Get (creating if necessary) the container used to store financial
    metrics. Partitioned by /company since queries are almost always
    scoped to a single company.
    """
    client = get_cosmos_client()

    database = client.create_database_if_not_exists(
        id=os.getenv("COSMOS_DATABASE")
    )

    container = database.create_container_if_not_exists(
        id=os.getenv("COSMOS_CONTAINER"),
        partition_key=PartitionKey(path="/company")
    )

    return container

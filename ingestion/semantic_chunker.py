from pathlib import Path

from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_experimental.text_splitter import SemanticChunker

from llm.embeddings import get_embeddings

load_dotenv()


def read_markdown(markdown_file: str) -> str:
    """
    Read markdown content.

    Args:
        markdown_file: Markdown file path.

    Returns:
        Markdown content.
    """
    return Path(markdown_file).read_text(encoding="utf-8")


def chunk_markdown(
    markdown_file: str,
    embeddings
) -> list[Document]:
    """
    Generate semantic chunks from markdown.

    Args:
        markdown_file: Markdown file path.
        embeddings: Embedding model used to detect semantic breakpoints.

    Returns:
        List of semantic chunks.

    Note: the default percentile threshold (95) produces very coarse
    chunks on dense documents like 10-Ks — some exceeded 20K characters
    in testing, which is both too large to fit in a rate-limited LLM
    prompt and diluted enough that vector search couldn't reliably
    distinguish "mentions revenue" from "is the revenue table". Lowering
    the threshold to 70 gives ~850-char chunks on average, small enough
    that a matched chunk usually contains the actual figure, not just a
    mention of it.
    """
    markdown_content = read_markdown(markdown_file)

    splitter = SemanticChunker(
        embeddings=embeddings,
        breakpoint_threshold_type="percentile",
        breakpoint_threshold_amount=70
    )

    return splitter.create_documents([markdown_content])


if __name__ == "__main__":
    embeddings = get_embeddings()

    markdown_file = "data/markdown/2024_Apple.md"

    chunks = chunk_markdown(
        markdown_file=markdown_file,
        embeddings=embeddings
    )

    print(f"Generated {len(chunks)} chunks\n")

    for index, chunk in enumerate(chunks[:3]):
        print("=" * 80)
        print(f"Chunk {index + 1}")
        print("=" * 80)
        print(chunk.page_content[:1000])
        print()

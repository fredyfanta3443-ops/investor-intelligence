import os

from dotenv import load_dotenv
from langchain_groq import ChatGroq
from pydantic import BaseModel

load_dotenv()

DEFAULT_MODEL = "openai/gpt-oss-120b"


def get_chat_model(temperature: float = 0) -> ChatGroq:
    """
    Create the Groq chat model client.
    """
    return ChatGroq(
        model=os.getenv("GROQ_CHAT_MODEL", DEFAULT_MODEL),
        temperature=temperature
    )


def get_structured_completion(
    prompt: str,
    response_model: type[BaseModel]
) -> BaseModel:
    """
    Generate a structured (Pydantic-typed) completion.

    Uses LangChain's with_structured_output in json_mode rather than the
    default tool-calling method — some Groq models occasionally return
    plain JSON text instead of making a proper tool call, which the
    default (strict tool-choice) method rejects as an error. json_mode
    just asks for JSON directly, which these models follow reliably.
    The prompt must explicitly ask for JSON (Groq's API requires the
    word "json" to appear in the prompt when json_mode is used).

    Args:
        prompt: Input prompt.
        response_model: Pydantic response model.

    Returns:
        An instance of response_model.
    """
    llm = get_chat_model()
    structured_llm = llm.with_structured_output(response_model, method="json_mode")

    return structured_llm.invoke(prompt)


def get_chat_completion(prompt: str) -> str:
    """
    Generate a plain-text completion (used by the chat/RAG endpoint).
    """
    llm = get_chat_model()
    response = llm.invoke(prompt)

    return response.content

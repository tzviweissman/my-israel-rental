"""LLM-backed translation helper shared by the contract-translation routes."""
import uuid

from fastapi import HTTPException
from emergentintegrations.llm.chat import LlmChat, UserMessage

from routes.deps import EMERGENT_LLM_KEY


async def translate_text(text: str, direction: str) -> str:
    """Translate contract text between Hebrew and English using Claude.

    direction: 'he-en' or 'en-he'
    """
    if direction == "he-en":
        from_lang, to_lang = "Hebrew", "English"
    elif direction == "en-he":
        from_lang, to_lang = "English", "Hebrew"
    else:
        raise HTTPException(status_code=400, detail="Invalid direction. Use 'he-en' or 'en-he'")
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message=(
            f"You are a professional legal document translator specializing in Israeli rental contracts. "
            f"Translate the following contract text from {from_lang} to {to_lang}. "
            f"Maintain the original formatting, paragraph structure, and legal terminology. "
            f"Only provide the translation, no explanations or notes."
        ),
    )
    chat.with_model("anthropic", "claude-4-sonnet-20250514")
    return await chat.send_message(UserMessage(text=text))

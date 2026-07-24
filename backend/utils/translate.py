"""LLM-backed translation helper shared by the contract-translation routes."""
import uuid

from fastapi import HTTPException

from routes.deps import ANTHROPIC_API_KEY
from utils.llm import LlmChat, UserMessage


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
        api_key=ANTHROPIC_API_KEY,
        session_id=str(uuid.uuid4()),
        system_message=(
            f"You are a professional legal document translator specializing in Israeli rental contracts. "
            f"Translate the following contract text from {from_lang} to {to_lang}. "
            f"Maintain the original formatting, paragraph structure, and legal terminology. "
            f"Only provide the translation, no explanations or notes."
        ),
    )
    chat.with_model("anthropic", "claude-sonnet-4-6")
    return await chat.send_message(UserMessage(text=text))


async def translate_marketing_to_hebrew(text: str) -> str:
    """Marketing-copy translator (as opposed to the legal-contract prompt
    above). Used to auto-populate ``title_he`` / ``description_he`` on
    marketplace gigs so Hebrew-locale renters see native Hebrew copy
    without providers having to write everything twice.

    Keeps output punchy — no explanations, no quotation marks — so the
    result drops straight into a card title or list item.
    """
    text = (text or "").strip()
    if not text:
        return ""
    chat = LlmChat(
        api_key=ANTHROPIC_API_KEY,
        session_id=str(uuid.uuid4()),
        system_message=(
            "You translate short marketing copy for a services marketplace from "
            "English into modern, natural Hebrew. Preserve the tone (friendly, "
            "professional). Do NOT wrap the output in quotes and do NOT add "
            "explanations, notes, or transliteration — return only the Hebrew "
            "translation of the input."
        ),
    )
    chat.with_model("anthropic", "claude-sonnet-4-6")
    out = await chat.send_message(UserMessage(text=text))
    return (out or "").strip().strip('"').strip("'")

"""LLM-backed translator for live chat messages.

Kept separate from the legal-contract translator because chat messages need
a much more conversational tone and Hebrew/English autodetection."""
import re
import uuid

from emergentintegrations.llm.chat import LlmChat, UserMessage

from routes.deps import EMERGENT_LLM_KEY

_HEBREW_RE = re.compile(r"[\u0590-\u05FF]")


def detect_language(text: str) -> str:
    """Return 'he' if the text contains any Hebrew characters, else 'en'."""
    return "he" if _HEBREW_RE.search(text or "") else "en"


async def translate_chat_message(text: str, target_lang: str) -> str:
    """Translate a single chat message into ``target_lang`` ('en' or 'he')."""
    target_full = "English" if target_lang == "en" else "Hebrew"
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message=(
            f"You are translating informal real-estate chat messages between "
            f"renters and property owners. Translate the user's message into "
            f"{target_full}. Keep the tone natural and conversational. "
            f"Preserve emojis, phone numbers, prices, and dates verbatim. "
            f"Output only the translation — no quotes, prefixes, or notes."
        ),
    )
    chat.with_model("anthropic", "claude-4-sonnet-20250514")
    return (await chat.send_message(UserMessage(text=text))).strip()

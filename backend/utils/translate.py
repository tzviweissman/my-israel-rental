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


# ── Language detection (spec 1.1) ─────────────────────────────────────
#
# Deterministic and free. The alternative — asking the model what language
# something is in — would double the API calls on every save to answer a
# question a character range already answers.
#
# ֐-׿ is the Hebrew block. The test is a RATIO, not "contains a
# Hebrew character", because real posts are mixed: "דירת 3 חדרים ב-Ramat
# Eshkol" is Hebrew with Latin in it, and "3-bed near Geula, שכונה שקטה" is
# English with Hebrew in it. Counting letters and taking the majority gets
# both right where a contains-check gets one wrong.
HEBREW_RANGE = ("֐", "׿")

# Above this share of the letters, call it Hebrew. Set below half on
# purpose: Hebrew posts carry Latin place names, prices and phone numbers,
# so a 50% bar would misfile them as English — and misfiling means we
# translate Hebrew into Hebrew and never produce the English a browsing
# owner needs.
HEBREW_THRESHOLD = 0.30


def detect_lang(*texts: str) -> str:
    """'he' or 'en' for one or more pieces of copy, judged together.

    Title and description are passed together on purpose. A title like
    "דירה" next to an English description is one post in one language, and
    judging the fields separately would give a record two source languages
    and translate the wrong half.

    Defaults to 'en' when there is nothing to judge — an empty post has no
    language, and 'en' is what the existing pipeline already assumed.
    """
    lo, hi = HEBREW_RANGE
    hebrew = 0
    letters = 0
    for text in texts:
        for ch in str(text or ""):
            if ch.isalpha():
                letters += 1
                if lo <= ch <= hi:
                    hebrew += 1
    if not letters:
        return "en"
    return "he" if (hebrew / letters) >= HEBREW_THRESHOLD else "en"


LANG_NAMES = {"he": "Hebrew", "en": "English"}


async def translate_marketing(text: str, target_lang: str) -> str:
    """Marketing-copy translator, in either direction (spec 1.3).

    Same prompt and tone as the Hebrew-only version this generalises; only
    the target language is parameterised. Kept separate from
    ``translate_text`` above, which is a LEGAL translator with a contract
    prompt — running listing copy through it produces stiff, lawyerly
    output.

    Returns '' for empty input without calling the API, so a post with no
    description does not spend a request discovering that.
    """
    text = (text or "").strip()
    if not text:
        return ""
    target = LANG_NAMES.get(target_lang)
    if not target:
        raise ValueError(f"translate_marketing: unsupported target_lang {target_lang!r}")
    source = "Hebrew" if target == "English" else "English"
    chat = LlmChat(
        api_key=ANTHROPIC_API_KEY,
        session_id=str(uuid.uuid4()),
        system_message=(
            f"You translate short marketing copy for a rentals and services "
            f"marketplace from {source} into modern, natural {target}. Preserve "
            f"the tone (friendly, professional). Keep place names, prices and "
            f"phone numbers as they are. Do NOT wrap the output in quotes and do "
            f"NOT add explanations, notes, or transliteration — return only the "
            f"{target} translation of the input."
        ),
    )
    chat.with_model("anthropic", "claude-sonnet-4-6")
    out = await chat.send_message(UserMessage(text=text))
    return (out or "").strip().strip('"').strip("'")


async def translate_marketing_to_hebrew(text: str) -> str:
    """English -> Hebrew marketing copy.

    Now a thin wrapper over ``translate_marketing``. Kept because a dozen
    call sites use it and its name says what they mean; deleting it would
    have turned a two-function change into a rename across the codebase for
    no benefit.
    """
    return await translate_marketing(text, "he")

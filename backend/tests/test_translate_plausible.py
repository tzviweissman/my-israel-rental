"""A translation is only saved if it is a translation.

WHY. The model answered an input instead of translating it, and the answer
was saved as the post's Hebrew title: "Cheese danish" carried "גביניות דניות
--- It seems like you may have sent a test message... Please share the
marketing copy you'd like translated into Hebrew", and a Hebrew visitor read
that on the home page. translate_marketing returned whatever came back.

No database and no API: the check is pure, and the one test of
translate_marketing mocks the model.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from unittest.mock import patch

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from utils import translate  # noqa: E402
from utils.translate import plausible_translation  # noqa: E402

LEAKED = (
    "גביניות דניות --- It seems like you may have sent a test message or the wrong text. "
    "Please share the marketing copy you'd like translated into Hebrew, and I'll get it done for you!"
)


def test_the_leaked_reply_is_rejected():
    assert not plausible_translation("Cheese danish", LEAKED, "he")


def test_real_translations_pass_both_ways():
    assert plausible_translation("Cheese danish", "גביניות דניות", "he")
    assert plausible_translation("Deep clean, Ramat Eshkol", "ניקיון יסודי, Ramat Eshkol", "he")
    assert plausible_translation("דירת 3 חדרים בגאולה", "3-room apartment in Geula", "en")


def test_hebrew_may_keep_latin_names_and_prices():
    assert plausible_translation("iPhone 15 repair", "תיקון iPhone 15", "he")


def test_wrong_language_is_rejected():
    # Asked for Hebrew, got English back (the model echoed the input).
    assert not plausible_translation("Cheese danish", "Cheese danish", "he")
    # Asked for English, got Hebrew back.
    assert not plausible_translation("דירה", "דירה יפה", "en")


def test_commentary_phrases_are_rejected():
    for reply in (
        "Here is the translation: 3-room apartment",
        "Could you please provide the text?",
        "I'd be happy to help, but I don't see any text.",
    ):
        assert not plausible_translation("דירה", reply, "en"), reply


def test_hebrew_refusals_are_rejected():
    """An English->Hebrew refusal written in Hebrew passes the language
    check by construction; the phrase list has to catch it."""
    for reply in (
        "נראה ששלחת הודעת בדיקה. אנא שלח את הטקסט שברצונך לתרגם.",
        "תוכל לשלוח את הטקסט המלא?",
        "להלן התרגום: דירה יפה",
        "כמודל שפה, אינני יכול לעזור בזה",
    ):
        assert not plausible_translation("Cheese danish", reply, "he"), reply


def test_a_clarifying_question_is_rejected_when_the_source_asks_nothing():
    assert not plausible_translation("Deep clean", "מה בדיוק לתרגם?", "he")
    # A question in the source may be translated as a question.
    assert plausible_translation("Need a mover?", "צריכים מוביל?", "he")


def test_ordinary_hebrew_marketing_copy_still_passes():
    for source, out in (
        ("Happy to help with your move", "נשמח לעזור לכם במעבר"),
        ("Translation services, English and Hebrew", "שירותי תרגום, אנגלית ועברית"),
        ("Send us a message today", "שלחו לנו הודעה היום"),
    ):
        assert plausible_translation(source, out, "he"), out


def test_runaway_length_is_rejected():
    long_he = "דירה " * 40
    assert not plausible_translation("Flat", long_he, "he")


def test_empty_is_rejected():
    assert not plausible_translation("Flat", "", "he")
    assert not plausible_translation("Flat", "   ", "he")


def test_translate_marketing_returns_empty_instead_of_the_reply():
    class FakeChat:
        def __init__(self, *a, **k):
            pass

        def with_model(self, *a, **k):
            return self

        async def send_message(self, _msg):
            return LEAKED

    with patch.object(translate, "LlmChat", FakeChat):
        out = asyncio.run(translate.translate_marketing("Cheese danish", "he"))
    assert out == ""


def test_translate_marketing_keeps_a_real_translation():
    class FakeChat:
        def __init__(self, *a, **k):
            pass

        def with_model(self, *a, **k):
            return self

        async def send_message(self, _msg):
            return '"גביניות דניות"'

    with patch.object(translate, "LlmChat", FakeChat):
        out = asyncio.run(translate.translate_marketing("Cheese danish", "he"))
    assert out == "גביניות דניות"

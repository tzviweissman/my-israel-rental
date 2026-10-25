"""One short marketing line, English to Hebrew, for a business page's card on /showcase.

    python backend/scripts/he_line.py "Whipped coffee in a jar, delivered to your door"

Called by scripts/publish-page.mjs when it adds a new site to frontend/public/showcase/showcase.json
(Tzvi, 25 Oct 2026: the cards need their Hebrew line too). The same prompt and model as
utils/translate.py's translate_marketing, without importing the app (which would need the database).
One short request per newly published site. ANTHROPIC_API_KEY comes from backend/.env and is never printed.
Prints only the Hebrew line; exits 1 on any failure, and the card then shows its English line.
"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

import anthropic  # noqa: E402

SYSTEM = (
    "You translate short marketing copy for a rentals and services marketplace from English into modern, "
    "natural Hebrew. Preserve the tone (friendly, professional). Keep place names, prices and phone numbers "
    "as they are. Do NOT wrap the output in quotes and do NOT add explanations, notes, or transliteration - "
    "return only the Hebrew translation of the input."
)


def main() -> int:
    text = " ".join(sys.argv[1:]).strip()
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not text or not key:
        return 1
    r = anthropic.Anthropic(api_key=key).messages.create(
        model="claude-sonnet-4-6", max_tokens=200, system=SYSTEM, messages=[{"role": "user", "content": text}])
    out = "".join(b.text for b in r.content if getattr(b, "type", "") == "text").strip().strip('"').strip("'")
    # a real Hebrew line: Hebrew letters, and not a paragraph
    if not any("֐" <= ch <= "׿" for ch in out) or len(out) > len(text) * 2 + 20:
        return 1
    sys.stdout.reconfigure(encoding="utf-8")
    print(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())

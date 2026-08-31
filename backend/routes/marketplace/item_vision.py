"""Draft an item's category and specifics from its photo.

WHY THIS EXISTS AT ALL. Filters can only exist where structured fields
exist, and structured fields only exist if somebody fills them in. The
research on this is unambiguous: listing is the scarce act. A seller who
is asked eight questions about a sofa posts fewer sofas, and eBay
measured 50% fewer listing steps purely from moving photos to position
one. So the friction rule for the goods composer is absolute - none of
the item specifics may slow listing down.

The resolution is to invert authorship: THE PHOTO PRODUCES THE
ATTRIBUTES AND THE SELLER CONFIRMS THEM. The seller's job is review, not
data entry. Everything arrives pre-filled and correctable.

WHAT THIS DRAFTS AND WHAT IT DELIBERATELY DOES NOT.

Drafted: `category` and the structured `attributes` - brand, colour,
material, rough dimensions, voltage. These are enums and short strings,
every one of them is shown back to the seller before anything is posted,
and a wrong one costs a tap to fix.

Not drafted: the title and description are OFFERED as a suggestion the
seller has to accept, never written into the post on their behalf. A
model looking at a photograph will write "in excellent condition" about
a sofa it cannot sit on, and the seller is the person who has to stand
behind that sentence to a buyer standing in their living room. Condition
claims stay authored by the human making them.

Also not drafted: `serial_or_imei` and `frame_number`. They are safety
controls whose entire value is that a seller published a real one; a
model transcribing digits off a blurry sticker would produce a
plausible-looking wrong number, which is worse than a blank field
because it looks checked.

MODEL OUTPUT IS UNTRUSTED INPUT. Everything that comes back goes through
`normalize_attributes`, the same function that validates what a browser
posts. An invented slug, a hallucinated enum value or an attribute that
does not belong to the chosen category is dropped, not stored. This is
not defensive politeness - a facet counting values no filter can match
is exactly the failure the schema exists to prevent, and it does not
matter whether the bad value came from a stale client or from us.

CONFIDENCE IS RETURNED, NOT ACTED ON. The model says how sure it is
about the category, and this module passes that through rather than
deciding. A high-confidence guess is pre-selected in the composer; a low
one is shown as a suggestion the seller picks from. The difference
matters because a wrong pre-selected category is a listing filed
somewhere nobody looks, and the seller will not notice it if the field
looks answered.

IT NEVER RAISES AND IT IS NEVER REQUIRED. No API key, no network, a
refusal, malformed JSON, a photo of nothing - every one of them returns
an empty draft, and the composer works exactly as it did before, with
the seller filling the fields themselves. A listing flow that breaks
because a vision call timed out is a worse product than one with no
vision at all.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

from .item_taxonomy import (
    CATEGORY_FIELDS,
    ITEM_CATEGORIES,
    ITEM_CATEGORY_SLUGS,
    PROVENANCE_FIELDS,
    SHARED_FIELDS,
    normalize_attributes,
)

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-6"

# Enough for a category, a confidence, a dozen short attributes and a
# title line. The prompt asks for JSON and nothing else; a reply that
# needs more room than this is a reply that has gone wrong.
MAX_TOKENS = 1000

# Fields the model is never asked for, and which are stripped if it
# volunteers them anyway. See the module docstring: a plausible-looking
# wrong serial number is worse than a blank one.
NEVER_DRAFTED: tuple[str, ...] = PROVENANCE_FIELDS

CONFIDENCE_LEVELS = ("high", "low")


def _empty(reason: str) -> dict[str, Any]:
    """The shape returned whenever there is nothing to say.

    Always the same keys, so no caller has to branch on whether the draft
    ran. `reason` is for the log and for a test to assert on; it is not
    shown to the seller, who does not need to know that a vision call
    they never asked for did not happen.
    """
    return {
        "available": False,
        "reason": reason,
        "category": None,
        "confidence": None,
        "attributes": {},
        "title_suggestion": None,
    }


def is_configured() -> bool:
    """Whether a drafting call could work at all.

    Checked before the HTTP route spends a request, and mirrored to the
    client so the composer can skip showing a spinner for something that
    was never going to run.
    """
    return os.environ.get("ANTHROPIC_API_KEY", "").startswith("sk-ant-")


def _describe(field: dict[str, Any]) -> str:
    kind = field["type"]
    if kind == "enum":
        values = " | ".join(o["value"] for o in field.get("options", []))
        return "{} [{}]".format(field["key"], values)
    if kind == "bool":
        return "{} [true | false]".format(field["key"])
    if kind == "number":
        return "{} (a number in {})".format(field["key"], field.get("unit") or "units")
    return "{} (short text)".format(field["key"])


def _vocabulary() -> str:
    """The exact vocabulary the model may answer in.

    Generated from the schema rather than written out, because a prompt
    that lists the categories by hand is a second copy of the taxonomy,
    and the second copy is the one that goes stale. Add a category below
    and the model learns about it the moment it is added.
    """
    lines: list[str] = ["CATEGORIES (answer with the slug on the left):"]
    for cat in ITEM_CATEGORIES:
        lines.append("  {} - {}".format(cat["slug"], cat["label"]))

    lines += [
        "",
        "ATTRIBUTES, per category. Only use keys listed for the category you",
        "chose, plus the shared ones. Use the exact option values shown in",
        "brackets; never invent one.",
        "",
        "  shared (any category):",
    ]
    for field in SHARED_FIELDS:
        lines.append("    " + _describe(field))
    for cat in ITEM_CATEGORIES:
        slug = cat["slug"]
        fields = [f for f in CATEGORY_FIELDS.get(slug, []) if f["key"] not in NEVER_DRAFTED]
        if not fields:
            continue
        lines.append("  {}:".format(slug))
        for field in fields:
            lines.append("    " + _describe(field))
    return "\n".join(lines)


SYSTEM = """You are helping someone list a second-hand item for sale in Israel.

You are given a photograph and sometimes a few words the seller typed.
Return ONLY a JSON object, no prose and no code fence:

{"category": "<slug or null>",
 "confidence": "high" | "low",
 "attributes": {"<key>": "<value>", ...},
 "title_suggestion": "<short factual title, or null>"}

Rules that matter:

- Only fill an attribute you can actually SEE, or that the seller's words
  state. A guess that looks like an answer is worse than a blank field,
  because the seller will not correct a field that already looks filled.
- "confidence" is about the CATEGORY only. Say "low" whenever more than
  one category could be right, or the photo is unclear.
- If the photo does not show a sellable physical object, return
  {"category": null, "confidence": "low", "attributes": {}, "title_suggestion": null}.
- Never describe condition. Never say "excellent", "like new", "great
  value", or anything about price. You cannot judge wear from a
  photograph and the seller is the one who has to stand behind it.
- title_suggestion is what the thing IS, plainly: "Three-seat fabric sofa",
  "Bosch washing machine". No adjectives of quality.
- Voltage matters more here than anywhere else. Many people in this market
  carry 110V appliances from abroad. Fill it only from a visible label or
  rating plate, never from the brand.
"""


def _extract_json(text: str) -> dict[str, Any] | None:
    """The first JSON object in the reply.

    Models fence JSON, or preface it, more often than the prompt would
    suggest. Parsing from the outermost braces costs nothing and turns a
    perfectly good answer that arrived inside a code fence from a total
    failure into a usable draft.
    """
    if not text:
        return None
    candidate = text.strip()
    if not candidate.startswith("{"):
        match = re.search(r"\{.*\}", candidate, re.DOTALL)
        if not match:
            return None
        candidate = match.group(0)
    try:
        parsed = json.loads(candidate)
    except (ValueError, TypeError):
        return None
    return parsed if isinstance(parsed, dict) else None


def interpret(raw: Any) -> dict[str, Any]:
    """Turn whatever the model returned into a draft the composer can use.

    Split out from the network call on purpose: every decision about
    trusting the output lives here, and it is testable without a key, a
    socket or a photograph.
    """
    if isinstance(raw, str):
        parsed = _extract_json(raw)
    elif isinstance(raw, dict):
        parsed = raw
    else:
        parsed = None
    if not parsed:
        return _empty("unparseable")

    category = parsed.get("category")
    if not isinstance(category, str) or category not in ITEM_CATEGORY_SLUGS:
        # Covers the model inventing a slug and the model answering with a
        # SERVICES slug, which is the exact mistake the taxonomy was split
        # in two to prevent.
        category = None

    confidence = parsed.get("confidence")
    if confidence not in CONFIDENCE_LEVELS:
        # An unrecognised confidence is read as low rather than dropped.
        # Low means "suggest, do not pre-select", which is the safe side of
        # this particular error.
        confidence = "low"

    raw_attrs = parsed.get("attributes")
    if not isinstance(raw_attrs, dict):
        raw_attrs = {}
    # Stripped before validation rather than after, so exactly one place
    # decides that the safety fields are never drafted.
    raw_attrs = {k: v for k, v in raw_attrs.items() if k not in NEVER_DRAFTED}
    # The same validator the API runs against a browser's submission.
    # Anything the category does not declare, and any enum value outside
    # the declared options, is dropped here.
    attributes = normalize_attributes(category, raw_attrs)

    title = parsed.get("title_suggestion")
    if not isinstance(title, str) or not title.strip():
        title = None
    else:
        title = title.strip()[:140]

    return {
        # A draft with no category and no attributes is not a draft. Saying
        # so lets the composer stay silent rather than announce that it
        # read the photo and found nothing.
        "available": bool(category or attributes),
        "reason": "ok",
        "category": category,
        "confidence": confidence if category else None,
        "attributes": attributes,
        "title_suggestion": title,
    }


async def draft_from_photo(photo_url: str, *, seller_text: str = "") -> dict[str, Any]:
    """Read one photo and draft what can be read off it.

    ONE photo, always the first. The others are usually the same object
    from another angle, and paying for four images to learn what the first
    one already said spends the seller's waiting time on nothing.
    """
    if not photo_url or not str(photo_url).startswith("https://"):
        # Not a validation nicety: this URL is handed to a third party to
        # fetch, so it may only ever be a real https delivery URL.
        return _empty("no-photo")
    if not is_configured():
        return _empty("not-configured")

    from utils.llm import LlmChat, UserMessage  # local: keeps import cost off startup

    prompt = _vocabulary()
    if seller_text.strip():
        prompt += "\n\nThe seller has typed this so far:\n" + seller_text.strip()[:600]
    prompt += "\n\nReturn the JSON object now."

    try:
        chat = LlmChat(system_message=SYSTEM).with_model("anthropic", MODEL)
        chat.with_params(max_tokens=MAX_TOKENS)
        reply = await chat.send_message(UserMessage(text=prompt, image_urls=[photo_url]))
    except Exception:
        # Every failure mode lands here and all of them have the same
        # product outcome: the seller fills the fields in themselves, which
        # is what they would have done anyway. Logged, never surfaced.
        logger.exception("item vision draft failed")
        return _empty("call-failed")

    return interpret(reply)

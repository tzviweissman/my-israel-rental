"""The photo-drafted listing: what it fills in, and what it refuses to.

THE POINT OF THESE TESTS IS THAT THE MODEL IS AN UNTRUSTED CALLER. It
sits on the wrong side of the same boundary a browser sits on, and it
fails in a way a browser does not: it returns confident, well-formed,
plausible values that are wrong. So every assertion below is about what
happens to output that LOOKS fine.

The failure being prevented is specific. A hallucinated enum value or an
attribute that does not belong to the chosen category, stored, produces
a facet that counts values no filter can ever match - the exact bug the
schema was written to make impossible. It does not matter that this bad
value came from us rather than from a stale client, and the code must
not care either: the model's output goes through the same
`normalize_attributes` a POST body does.

The other half is the friction rule. Vision is an accelerator and never
a dependency: no key, no network, a refusal, a photo of a wall - every
one of them has to leave the seller with a working form, because a
listing flow that breaks when a vision call times out is a worse product
than one with no vision at all.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes.marketplace import item_vision  # noqa: E402
from routes.marketplace.item_taxonomy import ITEM_CATEGORY_SLUGS  # noqa: E402


def _reply(**kwargs):
    """A well-formed model reply with the given fields overridden."""
    import json
    base = {"category": "furniture", "confidence": "high",
            "attributes": {}, "title_suggestion": None}
    base.update(kwargs)
    return json.dumps(base)


# --------------------------------------------------------------------------
# The happy path, so the tests below are known to be measuring something
# --------------------------------------------------------------------------

def test_a_good_reply_becomes_a_usable_draft():
    out = item_vision.interpret(_reply(
        category="furniture",
        attributes={"brand": "IKEA", "colour": "grey", "material": "fabric"},
        title_suggestion="Three-seat fabric sofa",
    ))
    assert out["available"] is True
    assert out["category"] == "furniture"
    assert out["confidence"] == "high"
    assert out["attributes"] == {"brand": "IKEA", "colour": "grey", "material": "fabric"}
    assert out["title_suggestion"] == "Three-seat fabric sofa"


def test_the_shape_is_the_same_whether_it_worked_or_not():
    """No caller should have to branch on whether the draft ran, so the
    keys are identical in both directions."""
    good = set(item_vision.interpret(_reply()))
    empty = set(item_vision._empty("whatever"))
    assert good == empty


# --------------------------------------------------------------------------
# Invented values are dropped, not stored
# --------------------------------------------------------------------------

def test_an_invented_category_is_refused():
    out = item_vision.interpret(_reply(category="antiques"))
    assert out["category"] is None
    assert out["confidence"] is None, "no category means no confidence in one"


def test_a_services_slug_is_refused():
    """The specific mistake the taxonomy was split in two to prevent. A
    sofa filed under 'Cleaning Services' is the bug that started all of
    this, and a model that has read the internet is more likely to reach
    for a services word than a made-up one."""
    for slug in ("cleaning", "moving", "handyman", "it-tech-support"):
        assert slug not in ITEM_CATEGORY_SLUGS, "test is asserting the wrong thing"
        assert item_vision.interpret(_reply(category=slug))["category"] is None


def test_a_hallucinated_enum_value_is_dropped():
    """`voltage` is a real appliances field; '240v' is not one of its
    options. Stored, it would appear in the facet aggregation as an option
    that no filter offers and nothing can select."""
    out = item_vision.interpret(_reply(
        category="appliances", attributes={"voltage": "240v", "plug_type": "il"}))
    assert "voltage" not in out["attributes"]
    assert out["attributes"]["plug_type"] == "il", "the good value survives the bad one"


def test_an_attribute_from_the_wrong_category_is_dropped():
    """`nusach` belongs to books-judaica. On a bicycle it is not a
    mistranslation, it is a field the listing page will never render and
    the seller will never see again."""
    out = item_vision.interpret(_reply(
        category="bikes-scooters", attributes={"nusach": "ashkenaz", "frame_size": "54"}))
    assert "nusach" not in out["attributes"]
    assert out["attributes"]["frame_size"] == "54"


def test_a_key_nothing_declares_is_dropped():
    out = item_vision.interpret(_reply(
        category="furniture", attributes={"vibe": "mid-century", "colour": "oak"}))
    assert out["attributes"] == {"colour": "oak"}


def test_attributes_are_dropped_wholesale_when_the_category_was_refused():
    """With no category there is no per-category schema, so only the
    shared fields can survive. A `material` kept without the category that
    declares it is an attribute pointing at nothing."""
    out = item_vision.interpret(_reply(
        category="not-a-category",
        attributes={"brand": "Bosch", "material": "wood", "voltage": "220v"}))
    assert out["category"] is None
    assert out["attributes"] == {"brand": "Bosch"}


# --------------------------------------------------------------------------
# The two safety fields are never drafted
# --------------------------------------------------------------------------

@pytest.mark.parametrize("category,key,value", [
    ("electronics", "serial_or_imei", "356938035643809"),
    ("bikes-scooters", "frame_number", "WTU123456K"),
])
def test_provenance_fields_are_never_drafted(category, key, value):
    """Their entire value is that a SELLER published a real one. A model
    reading digits off a blurry sticker produces a plausible wrong number,
    which is worse than a blank field because it looks checked - by the
    buyer who reads it, and by the seller who never corrects a field that
    already appears answered."""
    out = item_vision.interpret(_reply(category=category, attributes={key: value}))
    assert key not in out["attributes"]


def test_the_prompt_never_asks_for_them_either():
    """Belt and braces, and the cheaper of the two: a field never asked
    for is a field rarely volunteered."""
    vocabulary = item_vision._vocabulary()
    for key in item_vision.NEVER_DRAFTED:
        assert key not in vocabulary


# --------------------------------------------------------------------------
# Confidence
# --------------------------------------------------------------------------

def test_an_unrecognised_confidence_is_read_as_low():
    """Low means 'suggest, do not pre-select'. That is the safe side of
    this error: a wrong PRE-SELECTED category is a listing filed where
    nobody looks, and the seller will not notice because the field looks
    answered."""
    for junk in ("very high", "0.9", "", None, 7, "HIGH!"):
        assert item_vision.interpret(_reply(confidence=junk))["confidence"] == "low"


def test_high_confidence_survives():
    assert item_vision.interpret(_reply(confidence="high"))["confidence"] == "high"


# --------------------------------------------------------------------------
# Malformed replies leave a working form
# --------------------------------------------------------------------------

@pytest.mark.parametrize("junk", [
    "", "   ", "I'm sorry, I can't help with that.", "{", "{{}", "null",
    "[1,2,3]", "not json at all", None, 42, {"category": 5},
])
def test_junk_returns_an_empty_draft_and_never_raises(junk):
    out = item_vision.interpret(junk)
    assert out["available"] is False or out["category"] is None
    assert out["attributes"] == {}


def test_json_inside_a_code_fence_is_still_read():
    """Models fence JSON more often than the prompt would suggest, and
    throwing away a correct answer over three backticks is a self-inflicted
    failure."""
    fenced = "Here you go:\n```json\n" + _reply(category="appliances") + "\n```"
    assert item_vision.interpret(fenced)["category"] == "appliances"


def test_a_photo_of_nothing_reports_unavailable():
    """The documented refusal shape. `available: False` is what lets the
    composer stay silent rather than announce that it read the photo and
    found nothing."""
    out = item_vision.interpret(_reply(category=None, confidence="low"))
    assert out["available"] is False
    assert out["category"] is None


def test_a_title_only_reply_is_not_a_draft():
    """A title with no category and no attributes is a sentence, not
    structure, and structure is the only reason this call is made."""
    out = item_vision.interpret(_reply(category=None, title_suggestion="A chair"))
    assert out["available"] is False


def test_a_title_is_trimmed_to_what_the_field_accepts():
    out = item_vision.interpret(_reply(title_suggestion="x" * 400))
    assert len(out["title_suggestion"]) == 140


@pytest.mark.parametrize("blank", ["", "   ", None, 12])
def test_a_missing_title_is_none_not_an_empty_string(blank):
    """An empty string in the field would overwrite what the seller typed
    with nothing, which reads as the form having eaten their words."""
    assert item_vision.interpret(_reply(title_suggestion=blank))["title_suggestion"] is None


# --------------------------------------------------------------------------
# It is an accelerator, never a dependency
# --------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_no_api_key_means_no_call_and_no_error(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    def explode(*a, **k):  # pragma: no cover - the point is it is not reached
        raise AssertionError("attempted an LLM call with no key configured")

    monkeypatch.setattr(item_vision, "interpret", explode)
    out = await item_vision.draft_from_photo("https://res.cloudinary.com/x/image/upload/a.jpg")
    assert out["available"] is False
    assert out["reason"] == "not-configured"


@pytest.mark.asyncio
@pytest.mark.parametrize("url", [
    "", None, "http://res.cloudinary.com/x/a.jpg", "file:///etc/passwd",
    "ftp://example.com/a.jpg", "/relative/a.jpg",
])
async def test_a_non_https_photo_is_refused_before_anything_is_spent(monkeypatch, url):
    """This URL is handed to a third party to fetch, so 'is it https' is a
    boundary check, not a formatting nicety."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    out = await item_vision.draft_from_photo(url)
    assert out["reason"] == "no-photo"


@pytest.mark.asyncio
async def test_a_thrown_call_leaves_the_seller_with_a_working_form(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")

    class Boom:
        def __init__(self, *a, **k):
            pass

        def with_model(self, *a, **k):
            return self

        def with_params(self, *a, **k):
            return self

        async def send_message(self, *a, **k):
            raise RuntimeError("upstream is down")

    import utils.llm as llm
    monkeypatch.setattr(llm, "LlmChat", Boom)

    out = await item_vision.draft_from_photo("https://res.cloudinary.com/x/image/upload/a.jpg")
    assert out["available"] is False
    assert out["reason"] == "call-failed"
    assert out["attributes"] == {}


@pytest.mark.asyncio
async def test_the_seller_s_own_words_reach_the_prompt(monkeypatch):
    """A photo of a black rectangle plus the words 'Bosch dishwasher' is a
    much better draft than either alone, so the text is sent."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    seen = {}

    class Capture:
        def __init__(self, *a, **k):
            pass

        def with_model(self, *a, **k):
            return self

        def with_params(self, *a, **k):
            return self

        async def send_message(self, msg):
            seen["text"] = msg.text
            seen["images"] = msg.image_urls
            return _reply(category="appliances")

    import utils.llm as llm
    monkeypatch.setattr(llm, "LlmChat", Capture)

    await item_vision.draft_from_photo(
        "https://res.cloudinary.com/x/image/upload/a.jpg",
        seller_text="Bosch dishwasher, brought from the US",
    )
    assert "Bosch dishwasher" in seen["text"]
    # ONE photo, always the first: the rest are the same object from
    # another angle, and a second image spends the seller's waiting time
    # to learn what the first one already said.
    assert seen["images"] == ["https://res.cloudinary.com/x/image/upload/a.jpg"]


# --------------------------------------------------------------------------
# The prompt is generated from the schema, not written out beside it
# --------------------------------------------------------------------------

def test_every_category_reaches_the_prompt():
    """A hand-written category list in a prompt is a second copy of the
    taxonomy, and the second copy is the one that goes stale. If this ever
    fails it means a category exists that the model has never been told
    about, and it will never be suggested for anything."""
    vocabulary = item_vision._vocabulary()
    for slug in ITEM_CATEGORY_SLUGS:
        assert slug in vocabulary, slug


def test_every_enum_option_reaches_the_prompt():
    """Otherwise the model guesses a value the schema will then drop, and
    the field silently arrives empty."""
    from routes.marketplace.item_taxonomy import fields_for
    vocabulary = item_vision._vocabulary()
    for slug in ITEM_CATEGORY_SLUGS:
        for field in fields_for(slug):
            if field["type"] != "enum" or field["key"] in item_vision.NEVER_DRAFTED:
                continue
            for option in field["options"]:
                assert option["value"] in vocabulary, (slug, field["key"], option["value"])


def test_the_prompt_forbids_condition_claims():
    """The line that keeps a model from writing 'in excellent condition'
    about a sofa it cannot sit on. The seller is the person who has to
    stand behind that sentence to a buyer in their living room."""
    assert "condition" in item_vision.SYSTEM.lower()
    assert "excellent" in item_vision.SYSTEM.lower()

"""The locale files and the taxonomy say the same thing, in both languages.

WHY THIS EXISTS RATHER THAN A CODE REVIEW. A mirror of a Python structure
kept by hand in two JavaScript files drifts, and it drifts silently in the
worst direction: a key present in `en.js` and missing from `he.js` renders
ENGLISH to a Hebrew reader with no error, no warning and no visible
breakage. An entire section shipped that way here once.

The same class of bug already bit the services taxonomy this month, where
a hand-kept `CATEGORY_LABELS` mirror had a slug the Python side had
renamed. Nothing failed; the label just stopped resolving.

So parity is asserted in BOTH directions:

  * every category, attribute and enum option in the schema has a key in
    en.js AND he.js;
  * no key exists in the locale files that the schema does not declare -
    otherwise a removed field leaves a label behind that nothing renders
    and everyone assumes is still wired to something.

Parsed out of the JS with a narrow reader rather than executed, because
`en.js` is an ES module with imports and this suite has no JS runtime.
"""
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes.marketplace.item_taxonomy import (  # noqa: E402
    ITEM_CATEGORIES,
    ITEM_CATEGORY_SLUGS,
    fields_for,
)

LOCALES = Path(__file__).resolve().parents[2] / "frontend" / "src" / "locales"


def _block(text: str, name: str) -> str:
    """The body of a top-level `name: { ... }` block, brace-matched."""
    start = text.find(f"      {name}: {{")
    assert start != -1, f"{name} block not found"
    i = text.index("{", start)
    depth = 0
    for j in range(i, len(text)):
        if text[j] == "{":
            depth += 1
        elif text[j] == "}":
            depth -= 1
            if depth == 0:
                return text[i + 1:j]
    raise AssertionError(f"{name} block never closed")


def _flat_keys(body: str) -> set[str]:
    """Keys at the top level of a block, ignoring nested objects."""
    out, depth = set(), 0
    for line in body.splitlines():
        stripped = line.strip()
        if depth == 0:
            m = re.match(r"^'([^']+)':", stripped)
            if m:
                out.add(m.group(1))
        depth += stripped.count("{") - stripped.count("}")
    return out


def _nested_keys(body: str) -> dict[str, set[str]]:
    """{outerKey: {innerKeys}} for `itemAttributeOptions`."""
    out: dict[str, set[str]] = {}
    current = None
    for line in body.splitlines():
        stripped = line.strip()
        m_outer = re.match(r"^'([^']+)': \{$", stripped)
        if m_outer:
            current = m_outer.group(1)
            out[current] = set()
            continue
        if stripped.startswith("}"):
            current = None
            continue
        m_inner = re.match(r"^'([^']+)':", stripped)
        if m_inner and current:
            out[current].add(m_inner.group(1))
    return out


@pytest.fixture(scope="module")
def locales():
    data = {}
    for lang in ("en", "he"):
        path = LOCALES / f"{lang}.js"
        assert path.exists(), path
        data[lang] = path.read_text(encoding="utf-8")
    return data


# --------------------------------------------------------------------------

@pytest.mark.parametrize("lang", ["en", "he"])
def test_every_category_has_a_label(locales, lang):
    keys = _flat_keys(_block(locales[lang], "itemCategories"))
    missing = ITEM_CATEGORY_SLUGS - keys
    assert not missing, f"{lang}.js has no label for: {sorted(missing)}"


@pytest.mark.parametrize("lang", ["en", "he"])
def test_no_orphan_category_labels(locales, lang):
    keys = _flat_keys(_block(locales[lang], "itemCategories"))
    orphans = keys - ITEM_CATEGORY_SLUGS
    assert not orphans, f"{lang}.js labels categories that do not exist: {sorted(orphans)}"


def _all_fields():
    seen = {}
    for slug in sorted(ITEM_CATEGORY_SLUGS):
        for f in fields_for(slug):
            seen.setdefault(f["key"], f)
    return seen


@pytest.mark.parametrize("lang", ["en", "he"])
def test_every_attribute_has_a_label(locales, lang):
    keys = _flat_keys(_block(locales[lang], "itemAttributes"))
    missing = set(_all_fields()) - keys
    assert not missing, f"{lang}.js has no label for attributes: {sorted(missing)}"


@pytest.mark.parametrize("lang", ["en", "he"])
def test_no_orphan_attribute_labels(locales, lang):
    keys = _flat_keys(_block(locales[lang], "itemAttributes"))
    orphans = keys - set(_all_fields())
    assert not orphans, f"{lang}.js labels attributes that do not exist: {sorted(orphans)}"


@pytest.mark.parametrize("lang", ["en", "he"])
def test_every_enum_option_has_a_label(locales, lang):
    nested = _nested_keys(_block(locales[lang], "itemAttributeOptions"))
    for key, field in _all_fields().items():
        if field["type"] != "enum":
            continue
        assert key in nested, f"{lang}.js has no options block for {key}"
        expected = {o["value"] for o in field["options"]}
        missing = expected - nested[key]
        assert not missing, f"{lang}.js is missing {key} options: {sorted(missing)}"


def test_the_two_languages_carry_exactly_the_same_keys(locales):
    """The direction that fails silently. A key in en.js but not he.js
    renders English to a Hebrew reader and nothing reports it."""
    for block in ("itemCategories", "itemAttributes"):
        en = _flat_keys(_block(locales["en"], block))
        he = _flat_keys(_block(locales["he"], block))
        assert en == he, (
            f"{block}: only in en.js {sorted(en - he)}; only in he.js {sorted(he - en)}"
        )
    en_opts = _nested_keys(_block(locales["en"], "itemAttributeOptions"))
    he_opts = _nested_keys(_block(locales["he"], "itemAttributeOptions"))
    assert set(en_opts) == set(he_opts)
    for key in en_opts:
        assert en_opts[key] == he_opts[key], f"{key} options differ between languages"


def test_hebrew_labels_are_actually_hebrew(locales):
    """A copied English string in he.js passes a key-parity check and is
    still untranslated. Categories are the visible case, so they are the
    ones checked for Hebrew characters."""
    body = _block(locales["he"], "itemCategories")
    hebrew = re.compile(r"[֐-׿]")
    for line in body.splitlines():
        m = re.match(r"^\s*'([^']+)': '([^']+)',", line)
        if m and not hebrew.search(m.group(2)):
            pytest.fail(f"he.js itemCategories.{m.group(1)} is not in Hebrew: {m.group(2)!r}")


def test_the_python_side_and_en_js_agree_on_the_words(locales):
    """Not just the keys - the labels themselves. The schema is the source
    and en.js is generated from it, so a divergence means one was edited
    by hand."""
    body = _block(locales["en"], "itemCategories")
    from_js = dict(re.findall(r"'([^']+)': '([^']+)',", body))
    for c in ITEM_CATEGORIES:
        assert from_js.get(c["slug"]) == c["label"].replace("'", "\\'"), (
            f"{c['slug']}: schema says {c['label']!r}, en.js says {from_js.get(c['slug'])!r}"
        )

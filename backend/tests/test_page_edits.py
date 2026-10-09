"""What an owner may save from the page editor (routes/marketplace/page_edits.py).

Pure functions, no database: the edits are applied verbatim into the live
page's HTML by frontend/server.js, so this cleaning is what stands between
an editor and a script on a public page.
"""
import pytest
from fastapi import HTTPException

from routes.marketplace.page_edits import clean_edits, clean_html


def test_text_keeps_inline_formatting_only():
    out = clean_html('Fresh <span class="script">buns</span><br><b onclick="x()">now</b>')
    assert out == 'Fresh <span class="script">buns</span><br><b>now</b>'


@pytest.mark.parametrize("bad", [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<a href="javascript:alert(1)">x</a>',
    '<style>body{display:none}</style>',
    '<iframe src="https://evil"></iframe>',
])
def test_nothing_that_runs_or_loads_survives(bad):
    out = clean_html(bad)
    for word in ("<script", "onerror", "javascript:", "<style", "<iframe", "<img", "<a "):
        assert word not in out


def test_text_is_escaped():
    assert clean_html('5 < 6 & "ok"') == '5 &lt; 6 &amp; "ok"'


def test_keys_must_be_publish_keys():
    out = clean_edits({"text": {"t-ab12cd34-0": "a", "../x": "b", "i-ab12cd34-0": "c"}})
    assert out["text"] == {"t-ab12cd34-0": "a"}


def test_photos_must_be_https():
    out = clean_edits({"img": {
        "i-ab12cd34-0": "https://res.cloudinary.com/demo/image/upload/x.jpg",
        "i-ab12cd34-1": "javascript:alert(1)",
        "i-ab12cd34-2": 'https://x.com/a.jpg" onerror="1',
    }})
    assert list(out["img"]) == ["i-ab12cd34-0"]


def test_moves_are_numbers_within_bounds():
    out = clean_edits({"style": {"t-ab12cd34-0": {
        "d": {"x": "12", "y": 99999, "s": 9, "a": "c", "h": True},
        "m": {"x": "nan", "a": "justify", "h": "yes"},
        "z": {"x": 1},
    }}})
    assert out["style"] == {"t-ab12cd34-0": {"d": {"x": 12.0, "y": 6000, "s": 3, "a": "c", "h": True}}}


def test_too_long_or_too_many_is_refused():
    with pytest.raises(HTTPException):
        clean_edits({"text": {"t-ab12cd34-0": "x" * 3001}})
    with pytest.raises(HTTPException):
        clean_edits({"text": {f"t-ab12cd34-{i}": "x" for i in range(601)}})

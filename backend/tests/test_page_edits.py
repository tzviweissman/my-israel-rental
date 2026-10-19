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


def test_links_stay_safe():
    out = clean_html(r'<a href="//evil.com/x">a</a><a href="/\evil.com">b</a><a href="/business/x">c</a><a href="tel:055">d</a>')
    assert 'evil' not in out
    assert 'href="/business/x"' in out and 'href="tel:055"' in out


# The page gallery (19 Oct 2026): only our own uploads, bounded, focus kept in 0-100.
from routes.marketplace.page_edits import GalleryPhoto, clean_gallery  # noqa: E402

CLD = 'https://res.cloudinary.com/dirvyboe9/image/upload/v1/myisraelrental/abc.jpg'


def test_gallery_keeps_our_uploads_with_focus_in_bounds():
    out = clean_gallery([GalleryPhoto(url=CLD, fx=140, fy=-5, alt='<b>Box</b>')])
    assert out == [{'url': CLD, 'fx': 100, 'fy': 0, 'alt': '&lt;b&gt;Box&lt;/b&gt;'}]


@pytest.mark.parametrize('url', ['http://res.cloudinary.com/x/y.jpg', 'https://evil.example/x.jpg', 'javascript:alert(1)'])
def test_gallery_refuses_other_urls(url):
    with pytest.raises(HTTPException):
        clean_gallery([GalleryPhoto(url=url)])


def test_gallery_refuses_duplicates_and_too_many():
    with pytest.raises(HTTPException):
        clean_gallery([GalleryPhoto(url=CLD), GalleryPhoto(url=CLD)])
    with pytest.raises(HTTPException):
        clean_gallery([GalleryPhoto(url=CLD.replace('abc', f'p{i}')) for i in range(25)])

"""Regression tests for admin_import URL/list splitters.

`_split_urls` was added to fix a real production bug where Cloudinary
transformation URLs (``c_fill,w_400,h_300``) were being shredded into
broken pieces by the generic comma splitter, then mirror failures were
silently dropping the listing's photos.
"""
from routes.admin_import import _split_list, _split_urls


# --- _split_urls (URL-aware) -------------------------------------------

def test_split_urls_empty_inputs():
    assert _split_urls(None) == []
    assert _split_urls("") == []
    assert _split_urls([]) == []


def test_split_urls_cloudinary_transform_stays_intact():
    """The bug: a single Cloudinary URL with c_fill,w_400,h_300 was
    getting shredded into 3 broken pieces by the old splitter."""
    url = "https://res.cloudinary.com/demo/image/upload/c_fill,w_400,h_300/sample.jpg"
    assert _split_urls(url) == [url]


def test_split_urls_comma_separated_url_list():
    a = "https://example.com/a.jpg"
    b = "https://example.com/b.jpg"
    assert _split_urls(f"{a},{b}") == [a, b]
    assert _split_urls(f"{a}, {b}") == [a, b]


def test_split_urls_mixed_transformation_and_plain():
    a = "https://res.cloudinary.com/demo/image/upload/c_fill,w_400/a.jpg"
    b = "https://example.com/b.jpg"
    assert _split_urls(f"{a},{b}") == [a, b]


def test_split_urls_semicolon_pipe_newline_separators():
    a = "https://example.com/a.jpg"
    b = "https://example.com/b.jpg"
    assert _split_urls(f"{a};{b}") == [a, b]
    assert _split_urls(f"{a}|{b}") == [a, b]
    assert _split_urls(f"{a}\n{b}") == [a, b]


def test_split_urls_whitespace_separated():
    a = "https://example.com/a.jpg"
    b = "https://example.com/b.jpg"
    assert _split_urls(f"{a} {b}") == [a, b]
    assert _split_urls(f"{a}\t{b}") == [a, b]


def test_split_urls_list_input_passthrough():
    a = "https://example.com/a.jpg"
    b = "https://example.com/b.jpg"
    assert _split_urls([a, b, "", "  "]) == [a, b]


def test_split_urls_trailing_comma_no_empty_entry():
    a = "https://example.com/a.jpg"
    assert _split_urls(f"{a},") == [a]


# --- _split_list (generic, for amenities etc.) -------------------------

def test_split_list_empty_inputs():
    assert _split_list(None) == []
    assert _split_list("") == []
    assert _split_list([]) == []


def test_split_list_amenities_comma_split():
    """Amenities use the generic splitter and must still split on commas."""
    assert _split_list("wifi, oven, dryer") == ["wifi", "oven", "dryer"]


def test_split_list_semicolon_pipe():
    assert _split_list("wifi;oven|dryer") == ["wifi", "oven", "dryer"]

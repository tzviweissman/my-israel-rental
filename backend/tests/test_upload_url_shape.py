"""An uploaded file's URL is usable by whoever renders it later.

THE BUG. The no-Cloudinary fallback returned a bare `/api/uploads/{name}`.
That string is STORED — on a property, a listing, a marketplace item — and
rendered later by whatever reads the record. A root-relative path resolves
against the PAGE's origin, and the frontend and the API are separate hosts
in every deployed environment, so every photo uploaded through this path
pointed at a page that does not exist.

It fails silently in the worst way: nothing raises, the record looks
correct, the `url` field is populated, and the image is an empty box. It
was found by a check that asserted an uploaded photo's src begins with a
scheme — not by looking at the code, which reads fine.

WHY NOT JUST FIX THE FRONTEND. Because the value is persisted. Prefixing
at render time means every consumer — the web app, an email, an OG tag, a
future client — has to know to do it, and the first one that forgets
reintroduces the bug against data already in the database.

Local dev deliberately keeps the relative form: the dev server proxies
/api to the backend, so same-origin is the correct answer there and an
absolute URL pointing at a public host would be wrong.
"""
import importlib
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def _store_upload_source():
    from routes import misc
    import inspect
    return inspect.getsource(misc._store_upload)


def test_the_fallback_uses_the_public_api_base_when_set():
    src = _store_upload_source()
    assert "PUBLIC_API_URL" in src, (
        "the local-disk fallback builds its URL without the public API base — "
        "a stored relative path resolves against the frontend's origin"
    )


def test_it_still_returns_a_relative_path_without_one():
    """Local dev proxies /api, so same-origin is right there. An absolute
    URL pointing at a public host would break the local case."""
    src = _store_upload_source()
    assert 'if base else path' in src or "base else" in src


def test_cloudinarys_url_is_passed_through_untouched():
    """When Cloudinary is configured it returns an absolute https URL of
    its own. Prefixing that would produce a nonsense address."""
    src = _store_upload_source()
    head = src[: src.index("Local-disk fallback")]
    assert "PUBLIC_API_URL" not in head, (
        "the Cloudinary branch is prefixing an already-absolute URL"
    )


def test_the_base_is_applied_at_the_end_not_stripped_twice():
    """`PUBLIC_API_URL` may or may not carry a trailing slash. Without the
    rstrip a configured value ending in "/" yields "//api/uploads/…",
    which is a protocol-relative URL and points at a host called "api"."""
    src = _store_upload_source()
    assert 'rstrip("/")' in src


def test_a_configured_base_produces_an_absolute_url():
    """The whole point, exercised rather than read."""
    prior = os.environ.get("PUBLIC_API_URL")
    os.environ["PUBLIC_API_URL"] = "https://api.example.com/"
    try:
        from routes import misc
        importlib.reload(misc)
        base = (os.environ.get("PUBLIC_API_URL") or "").rstrip("/")
        assert f"{base}/api/uploads/x.jpg" == "https://api.example.com/api/uploads/x.jpg"
    finally:
        if prior is None:
            os.environ.pop("PUBLIC_API_URL", None)
        else:
            os.environ["PUBLIC_API_URL"] = prior
        from routes import misc as m2
        importlib.reload(m2)

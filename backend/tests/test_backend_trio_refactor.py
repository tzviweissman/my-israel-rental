"""Regression tests for the 2026-05-12 backend trio refactor:
  * postmark_webhook helpers (admin.py)
  * translate_booking_contract helpers (bookings.py)
  * bulk_upload helpers (_normalize_row + image fan-out)
"""
from __future__ import annotations

import asyncio
import os
import uuid
from datetime import UTC, datetime
from pathlib import Path

import pytest
from dotenv import load_dotenv
from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from routes import admin as admin_route  # noqa: E402
from routes import bookings as bookings_route  # noqa: E402
from routes import bulk_upload as bulk_route  # noqa: E402


@pytest.fixture()
def db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return client[os.environ["DB_NAME"]]


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# =============================== postmark_webhook helpers ====================

class TestEmailEventBuilder:
    def test_bounce_includes_hardbounce_metadata(self):
        payload = {
            "RecordType": "Bounce",
            "Email": "Foo@Bar.COM",
            "MessageID": "msg-123",
            "Tag": "welcome",
            "Type": "HardBounce",
            "Description": "Mailbox does not exist",
        }
        event = admin_route._build_email_event(payload)
        assert event["record_type"] == "Bounce"
        assert event["email"] == "foo@bar.com"  # lower-cased
        assert event["message_id"] == "msg-123"
        assert event["bounce_type"] == "HardBounce"
        assert event["description"] == "Mailbox does not exist"

    def test_delivery_uses_recipient_field(self):
        payload = {"RecordType": "Delivery", "Recipient": "x@y.z", "MessageID": "m"}
        event = admin_route._build_email_event(payload)
        assert event["email"] == "x@y.z"

    def test_unknown_record_type_no_user_update(self):
        event = admin_route._build_email_event({"RecordType": "Click", "Email": "a@b.c"})
        assert admin_route._user_email_update_from(event, {}) is None

    def test_hard_bounce_suppresses_with_reason(self):
        event = admin_route._build_email_event({"RecordType": "Bounce", "Email": "x@y.z"})
        payload = {"Type": "HardBounce", "Description": "Mailbox does not exist"}
        update = admin_route._user_email_update_from(event, payload)
        assert update["email_status"] == "bounced"
        assert update["email_suppressed"] is True
        assert update["email_suppressed_reason"] == "Mailbox does not exist"

    def test_soft_bounce_marks_bounced_but_does_not_record_reason(self):
        event = admin_route._build_email_event({"RecordType": "Bounce", "Email": "x@y.z"})
        update = admin_route._user_email_update_from(event, {"Type": "SoftBounce"})
        # Suppression still applies (we follow Postmark's "Bounce" semantics)
        assert update["email_suppressed"] is True
        # But no permanent-reason payload for transient soft bounces
        assert "email_suppressed_reason" not in update

    def test_delivery_clears_suppression(self):
        event = admin_route._build_email_event({"RecordType": "Delivery", "Email": "x@y.z"})
        update = admin_route._user_email_update_from(event, {})
        assert update["email_status"] == "delivered"
        assert update["email_suppressed"] is False

    def test_assert_webhook_token_blocks_wrong_secret(self, monkeypatch):
        monkeypatch.setattr(admin_route, "POSTMARK_WEBHOOK_SECRET", "real-secret")
        with pytest.raises(HTTPException) as ei:
            admin_route._assert_webhook_token("nope")
        assert ei.value.status_code == 401

    def test_assert_webhook_token_passes_when_unset(self, monkeypatch):
        monkeypatch.setattr(admin_route, "POSTMARK_WEBHOOK_SECRET", "")
        # No exception
        admin_route._assert_webhook_token(None)


# =============================== translate_booking_contract helpers ==========

class TestTranslateContractHelpers:
    def test_cached_translation_matches_direction(self):
        booking = {
            "contract_translated_text": "tx",
            "contract_translation_direction": "he-en",
        }
        result = bookings_route._cached_translation(booking, "he-en")
        assert result == {
            "translated_text": "tx",
            "direction": "he-en",
            "status": "completed",
            "cached": True,
        }

    def test_cached_translation_skipped_when_direction_differs(self):
        booking = {"contract_translated_text": "tx", "contract_translation_direction": "he-en"}
        assert bookings_route._cached_translation(booking, "en-he") is None

    def test_cached_translation_skipped_when_empty(self):
        assert bookings_route._cached_translation({}, "he-en") is None

    def test_load_translatable_booking_403_when_not_party(self, db):
        booking_id = f"b-{uuid.uuid4()}"
        _run(db.bookings.insert_one({
            "id": booking_id, "renter_id": "r1", "owner_id": "o1", "status": "confirmed"
        }))
        try:
            with pytest.raises(HTTPException) as ei:
                _run(bookings_route._load_translatable_booking(booking_id, "intruder"))
            assert ei.value.status_code == 403
        finally:
            _run(db.bookings.delete_one({"id": booking_id}))

    def test_load_translatable_booking_allows_renter(self, db):
        booking_id = f"b-{uuid.uuid4()}"
        _run(db.bookings.insert_one({
            "id": booking_id, "renter_id": "r1", "owner_id": "o1", "status": "confirmed"
        }))
        try:
            bk = _run(bookings_route._load_translatable_booking(booking_id, "r1"))
            assert bk["id"] == booking_id
        finally:
            _run(db.bookings.delete_one({"id": booking_id}))


# =============================== bulk_upload helpers =========================

class TestNormalizeRowPipeline:
    def _row(self, **overrides):
        base = {
            "title": "T", "address": "A", "area": "Tel Aviv",
            "rental_type": "Long Term", "property_type": "apartment",
            "bedrooms": "2",
            "monthly_price": "5000",
        }
        base.update(overrides)
        return base

    def test_normalize_required_missing_raises(self):
        with pytest.raises(ValueError, match="'title' is required"):
            bulk_route._normalize_row(self._row(title=""))

    def test_rental_type_lowercased_hyphenated(self):
        out = bulk_route._normalize_row(self._row(rental_type="Long Term"))
        assert out["rental_type"] == "long-term"

    def test_rental_type_invalid_rejected(self):
        with pytest.raises(ValueError, match="rental_type must be"):
            bulk_route._normalize_row(self._row(rental_type="garbage"))

    def test_numeric_coercion(self):
        out = bulk_route._normalize_row(self._row(bedrooms="3", floor="2", monthly_price="4500.5"))
        assert out["bedrooms"] == 3
        assert out["floor"] == 2
        assert out["monthly_price"] == 4500.5

    def test_amenities_list_split(self):
        out = bulk_route._normalize_row(self._row(amenities="wifi; ac;heating"))
        assert out["amenities"] == ["wifi", "ac", "heating"]

    def test_currency_defaults_to_ils(self):
        out = bulk_route._normalize_row(self._row())
        assert out["currency"] == "ILS"
        assert out["agent_fee_currency"] == "ILS"

    def test_currency_uppercased(self):
        out = bulk_route._normalize_row(self._row(currency="usd"))
        assert out["currency"] == "USD"

    def test_property_defaults_applied(self):
        out = bulk_route._normalize_row(self._row())
        assert out["property_type"] == "apartment"
        assert out["bathrooms"] == 1
        assert out["floor"] == 1
        assert out["condition"] == "renovated"
        assert out["furniture_option"] == "no_furniture"
        assert out["cancellation_policy"] == "flexible"


class TestAttachOneHelper:
    def test_missing_data_appended_to_missing(self, tmp_path, monkeypatch):
        monkeypatch.setattr(bulk_route, "UPLOAD_DIR", tmp_path)
        results = {"attached": [], "missing": [], "not_owned": []}
        images: list = []
        ok = bulk_route._attach_one("p1", "missing.jpg", None, images, results)
        assert ok is False
        assert images == []
        assert results["missing"] == [{"property_id": "p1", "filename": "missing.jpg"}]

    def test_unsupported_ext_appended_to_missing(self, tmp_path, monkeypatch):
        monkeypatch.setattr(bulk_route, "UPLOAD_DIR", tmp_path)
        results = {"attached": [], "missing": [], "not_owned": []}
        images: list = []
        ok = bulk_route._attach_one("p1", "evil.exe", b"x", images, results)
        assert ok is False
        assert results["missing"][0]["reason"] == "unsupported type"

    def test_success_writes_file_and_url(self, tmp_path, monkeypatch):
        monkeypatch.setattr(bulk_route, "UPLOAD_DIR", tmp_path)
        results = {"attached": [], "missing": [], "not_owned": []}
        images: list = []
        ok = bulk_route._attach_one("p1", "hero.jpg", b"BYTES", images, results)
        assert ok is True
        assert len(images) == 1
        assert images[0].startswith("/api/uploads/") and images[0].endswith(".jpg")
        # File actually on disk
        written = list(tmp_path.glob("*.jpg"))
        assert len(written) == 1
        assert written[0].read_bytes() == b"BYTES"

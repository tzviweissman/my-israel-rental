"""Response models — declared on every endpoint so:
  • Pydantic validates the response shape at runtime (drops extras silently
    per the platform's strict-default policy, but most models below set
    ``extra='allow'`` so MongoDB-enriched fields like ``owner_name`` keep
    flowing through to the frontend).
  • The OpenAPI schema names every payload, which lets us auto-generate
    TypeScript types into ``frontend/src/types/api.d.ts``.

If a handler returns a computed/enriched dict, the model below uses
``extra='allow'`` so additional keys pass through unchanged. New endpoints
should prefer a precise model where possible.
"""
from typing import Any

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Generic acks
# ---------------------------------------------------------------------------
class MessageResponse(BaseModel):
    """Plain ack with a human-readable message. Extras allowed so handlers
    can attach contextual fields (e.g. ``status``, ``logo_url``) without
    breaking the contract."""
    model_config = ConfigDict(extra='allow')
    message: str


class IdMessageResponse(BaseModel):
    """Response for create endpoints: returns the new resource id + message."""
    model_config = ConfigDict(extra='allow')
    id: str
    message: str


class OkResponse(BaseModel):
    """Webhook receipts and similar."""
    model_config = ConfigDict(extra='allow')
    ok: bool


class TypingStatusResponse(BaseModel):
    """Whether the chat counterparty is currently typing."""
    typing: bool


class TranslatedMessageResponse(BaseModel):
    """Result of a one-off chat-message translation."""
    message_id: str
    source_lang: str
    target_lang: str
    translated_text: str


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class UserPublic(BaseModel):
    model_config = ConfigDict(extra='allow')
    id: str
    email: str
    name: str
    role: str


class TokenResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    token: str
    user: UserPublic


class PasswordResetResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    message: str
    email_sent: bool


# ---------------------------------------------------------------------------
# Domain entities — the canonical fields are declared explicitly so the
# generated TypeScript types are useful in the frontend. ``extra='allow'``
# keeps the door open for handler-side enrichment fields (e.g. owner_name,
# property_title) without breaking responses that include them.
# ---------------------------------------------------------------------------
class PropertyOut(BaseModel):
    """Canonical persisted shape of a property document.

    Mirrors ``PropertyCreate`` plus the server-managed bookkeeping fields
    written by ``create_property`` / ``bulk/commit`` (id, owner_id, status,
    images, videos, views, created_at, etc.).

    Detail-route handlers also tack on ``owner_name`` / ``owner_email`` and
    ``admin_blocked_now`` / ``active_admin_block`` / ``admin_blocks``; those
    are picked up via ``extra='allow'`` rather than declared, since they are
    optional enrichments rather than guaranteed persisted fields.
    """
    model_config = ConfigDict(extra='allow')
    id: str
    owner_id: str | None = None
    title: str
    description: str | None = None
    rental_type: str
    property_type: str
    bedrooms: float | None = None
    bathrooms: float | None = None
    area: str
    address: str | None = None
    square_meters: float | None = None
    porch_square_meters: float | None = None
    porches: int | None = 0
    floor: float | None = None
    has_elevator: bool | None = False
    is_shabbat_elevator: bool | None = False
    is_tama: bool | None = False
    sukkah_compatible: bool | None = False
    has_agent_fee: bool | None = False
    agent_fee_price: float | None = None
    agent_fee_currency: str | None = None
    has_cleaning_fee: bool | None = False
    cleaning_fee_price: float | None = None
    cleaning_fee_currency: str | None = None
    max_guests: int | None = None
    condition: str | None = None
    furniture_option: str | None = None
    amenities: list[str] | None = []
    monthly_price: float | None = None
    nightly_price: float | None = None
    currency: str | None = None
    images: list[str] | None = []
    videos: list[str] | None = []
    cancellation_policy: str | None = None
    custom_cancellation_policy: str | None = None
    available_from: str | None = None
    starting_date: str | None = None
    minimum_booking_days: int | None = None
    checkin_time: str | None = None
    checkout_time: str | None = None
    holiday_tags: list[str] | None = []
    contract_url: str | None = None
    contract_uploaded_at: str | None = None
    ical_urls: list[str] | None = None
    ical_last_synced: str | None = None
    status: str | None = None
    views: int | None = 0
    created_at: str | None = None
    bulk_created: bool | None = None


class BookingOut(BaseModel):
    """Canonical booking shape returned by ``GET /api/bookings`` and friends.

    The core fields below are written at create time; status mutates on the
    accept / cancel / sign flows. ``property_title`` / ``property_location`` /
    ``property_rental_type`` are GET-only enrichment from ``GET /api/bookings``.
    """
    model_config = ConfigDict(extra='allow')
    id: str
    property_id: str
    renter_id: str | None = None
    owner_id: str | None = None
    start_date: str
    end_date: str
    message: str | None = None
    status: str
    created_at: str | None = None
    confirmed_at: str | None = None
    cancelled_at: str | None = None
    cancelled_by: str | None = None
    cancellation_reason: str | None = None
    cancellation_requested_at: str | None = None
    cancellation_denied: bool | None = None
    cancellation_denial_reason: str | None = None
    previous_status: str | None = None
    contract_signed: bool | None = None
    contract_sign_token: str | None = None
    contract_sent_at: str | None = None
    contract_signed_at: str | None = None
    signature_data: str | None = None
    signed_contract_url: str | None = None
    signer_legal_name: str | None = None
    contract_translated_text: str | None = None
    contract_original_text: str | None = None
    contract_translation_direction: str | None = None
    contract_translated_at: str | None = None


class ContractOut(BaseModel):
    """Persisted ``db.contracts`` document."""
    model_config = ConfigDict(extra='allow')
    id: str
    property_id: str | None = None
    sublease_id: str | None = None
    owner_id: str
    original_filename: str | None = None
    stored_filename: str | None = None
    file_type: str | None = None
    file_size: int | None = None
    extracted_text: str | None = None
    translated_text: str | None = None
    translation_direction: str | None = None
    translation_status: str | None = None
    signatures: list[dict] | None = []
    signed: bool | None = False
    sign_token: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class NotificationOut(BaseModel):
    """Persisted ``db.notifications`` document."""
    model_config = ConfigDict(extra='allow')
    id: str
    user_id: str
    type: str
    message: str
    read: bool
    created_at: str
    booking_id: str | None = None
    property_id: str | None = None
    sublease_id: str | None = None
    sender_id: str | None = None


class SavedSearchOut(BaseModel):
    """Persisted renter availability alert."""
    model_config = ConfigDict(extra='allow')
    id: str
    user_id: str
    email: str | None = None
    user_name: str | None = None
    name: str
    filters: dict
    date_fuzziness_days: int
    active: bool
    created_at: str
    expires_at: str


class SavedSearchMatchOut(BaseModel):
    """A property that fired against one of the renter's active alerts."""
    model_config = ConfigDict(extra='allow')
    id: str
    search_id: str
    search_name: str
    property_id: str
    reason: str
    sent_at: str
    property: dict | None = None


class SubleaseOut(BaseModel):
    """Persisted ``db.subleases`` document."""
    model_config = ConfigDict(extra='allow')
    id: str
    original_property_id: str
    subleasor_id: str
    available_from: str
    available_to: str
    price: float
    price_type: str
    currency: str | None = 'ILS'
    holiday_tags: list[str] | None = []
    bedrooms_available: int | None = None
    notes: str | None = None
    title: str
    description: str | None = None
    area: str | None = None
    address: str | None = None
    bathrooms: float | None = None
    images: list[str] | None = []
    amenities: list[str] | None = []
    property_type: str | None = None
    active: bool
    contract_id: str | None = None
    sign_token: str | None = None
    contract_signed: bool | None = None
    created_at: str
    updated_at: str | None = None


class MessageOut(BaseModel):
    """One chat message between a property owner and a renter."""
    model_config = ConfigDict(extra='allow')
    id: str
    property_id: str
    sender_id: str
    receiver_id: str
    message: str
    read: bool
    created_at: str


class ConversationOut(BaseModel):
    """Aggregated chat conversation surface (bilingual list view)."""
    model_config = ConfigDict(extra='allow')
    property_id: str
    property_title: str
    last_message: str | None = None
    last_message_time: str | None = None
    # True iff the last message in the thread was sent by the *current user*.
    # Drives the inbox preview-bubble alignment (right for me, left for them).
    last_message_from_me: bool | None = None
    unread: bool | None = None
    other_user: dict | None = None
    participants: list[dict] | None = None
    messages: list[dict] | None = None


class ServiceRequestOut(BaseModel):
    """Persisted ``db.service_requests`` / ``db.document_services`` row."""
    model_config = ConfigDict(extra='allow')
    id: str
    user_id: str
    service_type: str | None = None
    status: str
    created_at: str
    updated_at: str | None = None
    details: dict | None = None
    property_address: str | None = None
    tenant_name: str | None = None
    tenant_id: str | None = None
    additional_info: str | None = None


class EmailEventOut(BaseModel):
    """Postmark webhook event row stored in ``db.email_events``."""
    model_config = ConfigDict(extra='allow')
    id: str
    record_type: str
    email: str
    message_id: str | None = None
    tag: str | None = None
    bounce_type: str | None = None
    description: str | None = None
    received_at: str


class AdminBlockOut(BaseModel):
    """Super-admin "mark as booked" block on a property."""
    model_config = ConfigDict(extra='allow')
    id: str
    property_id: str
    start_date: str | None = None
    end_date: str | None = None
    indefinite: bool
    created_by: str
    created_at: str


# ---------------------------------------------------------------------------
# Aggregations / dashboards
# ---------------------------------------------------------------------------
class AdminDashboardResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    active_listings: int
    total_views: int
    total_inquiries: int
    total_users: int
    pending_services: int
    recent_properties: list[dict]


class AdminEmailHealthResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    window_days: int
    delivered: int
    bounced: int
    complained: int
    delivery_rate_pct: float | None
    suppressed_users: int
    recent_events: list[dict]


class ExchangeRateResponse(BaseModel):
    usd_to_ils: float
    ils_to_usd: float


class TranslationResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    translation: str | None = None
    translated_text: str | None = None
    direction: str | None = None
    status: str | None = None


# ---------------------------------------------------------------------------
# Bulk operations
# ---------------------------------------------------------------------------
class BulkSummary(BaseModel):
    model_config = ConfigDict(extra='allow')


class BulkParseResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    rows: list[dict]
    summary: dict


class BulkCommitResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    created: list[dict]
    skipped: list[dict]
    summary: dict


class BulkEditResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    updated: list[dict]
    skipped: list[dict]
    summary: dict


class BulkImagesAttachResponse(BaseModel):
    """Used by both bulk-images endpoints (zip + flat)."""
    model_config = ConfigDict(extra='allow')
    attached: list[dict] = []
    missing: list[dict] = []
    not_owned: list[str] = []


class BulkExtractResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    properties: list[dict]
    count: int


# ---------------------------------------------------------------------------
# iCal & uploads
# ---------------------------------------------------------------------------
class UploadResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    url: str
    file_type: str
    filename: str
    size: int


class LogoUploadResponse(BaseModel):
    logo_url: str


class BlockedDatesResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    internal: list[dict]
    external: list[dict]
    ical_urls_count: int
    last_synced: str | None


class IcalSyncResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    message: str
    last_synced: str | None = None


class IcalAddResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    message: str
    blocked_dates: int | None = None
    ical_urls: list[str]


# ---------------------------------------------------------------------------
# Contract-specific
# ---------------------------------------------------------------------------
class ContractUploadResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    id: str
    original_filename: str | None
    file_type: str
    extracted_text_length: int
    message: str


class ContractStatusResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    has_contract: bool
    contract_url: str | None
    uploaded_at: str | None
    rental_type: str | None


class ContractSignResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    message: str
    signed_at: str


class PropertyContractUploadResponse(BaseModel):
    contract_url: str
    message: str
    retroactive_notifications_sent: int


class BookingSignContractResponse(BaseModel):
    message: str
    booking_status: str
    signed_contract_url: str | None


class BookingTranslationResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    translated_text: str
    direction: str
    status: str
    cached: bool
    original_text: str | None = None


class ManagerPropertiesResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    manager: dict
    properties: list[dict]


class ContractTranslateResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    translated_text: str
    direction: str
    status: str


class SubleaseContractUploadResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    id: str
    sign_token: str
    original_filename: str | None
    message: str


class PublicContractResponse(BaseModel):
    """Public sublease-contract view via signing link (no auth)."""
    model_config = ConfigDict(extra='allow')
    id: str
    file_type: str | None
    signed: bool


# ---------------------------------------------------------------------------
# Admin pinpoints
# ---------------------------------------------------------------------------
class SubscribersResponse(BaseModel):
    subscribers: int


class LikeToggleResponse(BaseModel):
    liked: bool
    message: str


class BookingCreateResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    id: str
    status: str
    message: str


class AdminMarkBookedResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    message: str
    block: dict


class AdminBulkMarkBookedResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    message: str
    created: int
    skipped: int


class AdminToggleStatusResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    message: str
    status: str


class BookingAcceptResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    message: str
    contract_sent: bool


class SavedSearchCreateResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    id: str
    message: str
    expires_at: str | None = None
    existing: bool | None = None


# Ad-hoc allow-everything model (last resort for endpoints whose payload is
# too dynamic to model; still gives OpenAPI a name).
class AnyResponse(BaseModel):
    model_config = ConfigDict(extra='allow')


# --- Admin: revenue breakdown by document service type ---------------------
class ServiceRevenueRow(BaseModel):
    """One row of the admin revenue-by-service widget.

    ``service_type`` is the catalog key (e.g. ``kitzvat_yeladim``).
    ``label`` is a human-readable label suitable for direct display.
    """
    service_type: str
    label: str
    count: int
    revenue_usd: float


class ServiceRevenueResponse(BaseModel):
    window_days: int
    total_revenue_usd: float
    total_filings: int
    rows: list[ServiceRevenueRow]


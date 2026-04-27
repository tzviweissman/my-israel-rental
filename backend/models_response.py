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
    reset_token: str
    email_sent: bool


# ---------------------------------------------------------------------------
# Domain entities — wrapped permissively because handlers enrich documents
# with computed fields (owner_name, property_title, etc.) we don't want to
# silently drop.
# ---------------------------------------------------------------------------
class PropertyOut(BaseModel):
    model_config = ConfigDict(extra='allow')
    id: str


class BookingOut(BaseModel):
    model_config = ConfigDict(extra='allow')
    id: str


class ContractOut(BaseModel):
    model_config = ConfigDict(extra='allow')
    id: str


class NotificationOut(BaseModel):
    model_config = ConfigDict(extra='allow')
    id: str


class SavedSearchOut(BaseModel):
    model_config = ConfigDict(extra='allow')
    id: str


class SubleaseOut(BaseModel):
    model_config = ConfigDict(extra='allow')
    id: str


class MessageOut(BaseModel):
    model_config = ConfigDict(extra='allow')
    id: str


class ConversationOut(BaseModel):
    model_config = ConfigDict(extra='allow')
    property_id: str


class ServiceRequestOut(BaseModel):
    model_config = ConfigDict(extra='allow')
    id: str


class EmailEventOut(BaseModel):
    model_config = ConfigDict(extra='allow')
    id: str


class AdminBlockOut(BaseModel):
    model_config = ConfigDict(extra='allow')
    id: str


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

"""Email utilities powered by Postmark.

All transactional emails for MyIsraelRental are sent through Postmark. Inline
CSS is used so the templates render reliably across mail clients (Gmail,
Outlook, Apple Mail, etc.).
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Optional

from postmarker.core import PostmarkClient

logger = logging.getLogger(__name__)

# --- Configuration ---------------------------------------------------------
POSTMARK_SERVER_TOKEN = os.environ.get("POSTMARK_SERVER_TOKEN", "")
EMAIL_FROM = os.environ.get("EMAIL_FROM", "no-reply@myisraelrental.com")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "My Israel Rental")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://myisraelrental.com")
CONTACT_EMAIL = "mir@myisraelrental.com"
CONTACT_PHONE = os.environ.get("CONTACT_PHONE", "+972 55 322 5141")

# Brand palette
BRAND_TEAL = "#1E6A6A"
BRAND_GOLD = "#D4AF37"

# Lazy-initialise client so import doesn't fail when token missing (e.g. tests)
_postmark_client: Optional[PostmarkClient] = None
_mongo_db = None  # lazy Motor database handle for suppression lookups


def _get_db():
    """Lazy-init a shared Motor database for suppression lookups."""
    global _mongo_db
    if _mongo_db is None:
        from motor.motor_asyncio import AsyncIOMotorClient
        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME")
        if mongo_url and db_name:
            _mongo_db = AsyncIOMotorClient(mongo_url)[db_name]
    return _mongo_db


def _get_client() -> Optional[PostmarkClient]:
    global _postmark_client
    if _postmark_client is None:
        token = os.environ.get("POSTMARK_SERVER_TOKEN") or POSTMARK_SERVER_TOKEN
        if token:
            _postmark_client = PostmarkClient(server_token=token)
    return _postmark_client


def _from_address() -> str:
    from_email = os.environ.get("EMAIL_FROM") or EMAIL_FROM
    from_name = os.environ.get("EMAIL_FROM_NAME") or EMAIL_FROM_NAME
    return f"{from_name} <{from_email}>"


# --- Low-level sender -------------------------------------------------------
async def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    *,
    tag: Optional[str] = None,
    text_body: Optional[str] = None,
    skip_suppression_check: bool = False,
) -> bool:
    """Send an HTML email through Postmark. Non-blocking for callers via
    asyncio.to_thread. Returns True on success, False otherwise.

    If the recipient has been flagged as hard-bounced or spam-complained via
    the Postmark webhook (users.email_suppressed=True), the send is skipped
    unless skip_suppression_check=True.
    """
    client = _get_client()
    if client is None:
        logger.error("Postmark client unavailable — POSTMARK_SERVER_TOKEN not set")
        return False

    # Check suppression list (writable via the /webhooks/postmark endpoint)
    if not skip_suppression_check and to_email:
        try:
            _db = _get_db()
            if _db is not None:
                suppressed = await _db.users.find_one(
                    {"email": to_email.lower(), "email_suppressed": True},
                    {"_id": 0, "email_suppressed_reason": 1},
                )
                if suppressed:
                    logger.warning(
                        "Skipping email to %s — suppressed (%s)",
                        to_email, suppressed.get("email_suppressed_reason", "unknown"),
                    )
                    return False
        except Exception as e:  # noqa: BLE001
            # Don't block sends if suppression check fails
            logger.debug("Suppression check failed (non-fatal): %s", e)

    from_address = _from_address()

    def _send() -> dict:
        return client.emails.send(
            From=from_address,
            To=to_email,
            Subject=subject,
            HtmlBody=html_body,
            TextBody=text_body or _strip_html(html_body),
            MessageStream="outbound",
            Tag=tag or "transactional",
        )

    try:
        response = await asyncio.to_thread(_send)
        logger.info(
            "Postmark email sent to %s | subject=%s | message_id=%s",
            to_email,
            subject,
            response.get("MessageID"),
        )
        return True
    except Exception as e:  # noqa: BLE001
        logger.error("Postmark send failed to %s: %s", to_email, e)
        return False


def _strip_html(html: str) -> str:
    """Very small fallback to produce a plain-text body from HTML."""
    import re

    text = re.sub(r"<br\s*/?>", "\n", html)
    text = re.sub(r"</p>", "\n\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


# --- Shared branded wrapper -------------------------------------------------
def _wrap(inner_html: str, *, preheader: str = "") -> str:
    """Wrap inner content with branded header/footer. `preheader` is the
    preview text shown by mail clients next to the subject."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Israel Rental</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2b2b2b;">
  <span style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">{preheader}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f4f1;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.05);">
          <tr>
            <td style="background:{BRAND_TEAL};padding:28px 32px;text-align:left;">
              <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.3px;">My Israel Rental</div>
              <div style="color:{BRAND_GOLD};font-size:11px;letter-spacing:3px;margin-top:4px;text-transform:uppercase;">Your home in Israel</div>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 36px 28px 36px;">
              {inner_html}
            </td>
          </tr>
          <tr>
            <td style="background:#fafaf7;padding:20px 32px;border-top:1px solid #ececec;text-align:center;color:#888;font-size:12px;line-height:1.6;">
              Questions? Reach us at
              <a href="mailto:{CONTACT_EMAIL}" style="color:{BRAND_TEAL};text-decoration:none;">{CONTACT_EMAIL}</a>
              or <a href="tel:{CONTACT_PHONE.replace(' ', '')}" style="color:{BRAND_TEAL};text-decoration:none;">{CONTACT_PHONE}</a>.
              <br /><br />
              <span style="color:#bbb;font-size:11px;">&copy; My Israel Rental LLC — <a href="{FRONTEND_URL}" style="color:#bbb;text-decoration:none;">myisraelrental.com</a></span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _button(label: str, href: str, *, color: str = BRAND_TEAL) -> str:
    return (
        f'<div style="text-align:center;margin:28px 0;">'
        f'<a href="{href}" style="background:{color};color:#ffffff;padding:14px 34px;'
        f'text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;'
        f'display:inline-block;letter-spacing:0.3px;">{label}</a>'
        f"</div>"
    )


def _detail_row(label: str, value: str) -> str:
    return (
        f'<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#777;'
        f'font-size:13px;width:40%;">{label}</td>'
        f'<td style="padding:10px 0;border-bottom:1px solid #eee;color:#222;'
        f'font-size:13px;font-weight:600;text-align:right;">{value}</td></tr>'
    )


# --- High-level transactional email helpers --------------------------------
async def send_welcome_email(to_email: str, name: str, role: str, verification_link: Optional[str] = None) -> bool:
    verify_block = ""
    if verification_link:
        verify_block = (
            '<p style="color:#555;font-size:14px;line-height:1.7;margin:18px 0 4px;">'
            "Please verify your email address to activate all features:</p>"
            + _button("Verify Email", verification_link, color=BRAND_GOLD)
        )

    inner = f"""
    <h2 style="color:#222;font-size:22px;margin:0 0 8px;">Welcome, {name} 👋</h2>
    <p style="color:#555;font-size:14px;line-height:1.7;margin:0 0 18px;">
      Thanks for joining <strong style="color:{BRAND_TEAL};">My Israel Rental</strong>. We're excited to help you find — or fill — your next home in Israel.
    </p>
    <div style="background:#f7f7f4;border-left:4px solid {BRAND_TEAL};border-radius:8px;padding:16px 18px;margin:20px 0;">
      <div style="color:#333;font-size:13px;font-weight:600;margin-bottom:6px;">Your account</div>
      <div style="color:#666;font-size:13px;line-height:1.7;">
        Email: <strong>{to_email}</strong><br />
        Role: <strong>{role.title()}</strong>
      </div>
    </div>
    {verify_block}
    <p style="color:#555;font-size:14px;line-height:1.7;margin:18px 0 8px;">What you can do next:</p>
    <ul style="color:#555;font-size:13px;line-height:1.9;padding-left:20px;margin:0 0 10px;">
      <li>Browse long-term, short-term and vacation rentals across Israel</li>
      <li>List your sublease in a few clicks</li>
      <li>Request Arnona discounts, name changes and other government services</li>
    </ul>
    {_button("Open Dashboard", f"{FRONTEND_URL}/dashboard")}
    """
    return await send_email(
        to_email,
        "Welcome to My Israel Rental",
        _wrap(inner, preheader="Welcome to My Israel Rental — your home in Israel"),
        tag="welcome",
    )


async def send_password_reset_email(to_email: str, name: str, reset_link: str) -> bool:
    inner = f"""
    <h2 style="color:#222;font-size:22px;margin:0 0 8px;">Reset your password</h2>
    <p style="color:#555;font-size:14px;line-height:1.7;margin:0 0 12px;">
      Hi {name or "there"},<br />
      We received a request to reset your My Israel Rental password. Click the button below to choose a new one.
    </p>
    {_button("Reset Password", reset_link)}
    <div style="background:#fff8e6;border:1px solid #f1e3b2;border-radius:8px;padding:12px 16px;color:#7a5a00;font-size:12px;line-height:1.6;margin:18px 0;">
      ⏱ This link is valid for <strong>1 hour</strong>. If you didn't request this, you can safely ignore the email — your password won't change.
    </div>
    <p style="color:#999;font-size:12px;line-height:1.6;margin:18px 0 0;">
      Or copy this link into your browser:<br />
      <a href="{reset_link}" style="color:{BRAND_GOLD};word-break:break-all;">{reset_link}</a>
    </p>
    """
    return await send_email(
        to_email,
        "Reset your password — My Israel Rental",
        _wrap(inner, preheader="Reset your My Israel Rental password"),
        tag="password-reset",
    )


async def send_booking_confirmation_email(
    to_email: str,
    guest_name: str,
    property_title: str,
    property_location: str,
    check_in: str,
    check_out: str,
    total_price: Optional[float],
    currency: str = "USD",
    booking_id: Optional[str] = None,
    status: str = "confirmed",
) -> bool:
    """Email sent to the GUEST/RENTER confirming their booking (or request)."""
    is_confirmed = status == "confirmed"
    headline = "Your booking is confirmed 🎉" if is_confirmed else "Booking request received"
    subhead = (
        "We've saved your reservation. Here are your details:"
        if is_confirmed
        else "We've sent your request to the owner. You'll receive another email when it's accepted."
    )
    price_row = ""
    if total_price is not None and is_confirmed:
        currency_symbol = "₪" if currency == "ILS" else "$"
        price_row = _detail_row("Total", f"{currency_symbol}{total_price:,.2f}")

    booking_row = _detail_row("Booking ID", booking_id[:8].upper()) if booking_id else ""

    inner = f"""
    <h2 style="color:#222;font-size:22px;margin:0 0 8px;">{headline}</h2>
    <p style="color:#555;font-size:14px;line-height:1.7;margin:0 0 18px;">
      Hi {guest_name or "there"},<br />{subhead}
    </p>
    <div style="background:#f7f7f4;border-radius:10px;padding:18px 20px;margin:10px 0 20px;border-left:4px solid {BRAND_TEAL if is_confirmed else BRAND_GOLD};">
      <div style="color:{BRAND_TEAL};font-size:16px;font-weight:700;margin-bottom:4px;">{property_title}</div>
      <div style="color:#777;font-size:13px;margin-bottom:14px;">{property_location}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        {_detail_row("Check-in", check_in)}
        {_detail_row("Check-out", check_out)}
        {price_row}
        {booking_row}
      </table>
    </div>
    {_button("View Booking", f"{FRONTEND_URL}/dashboard")}
    <p style="color:#888;font-size:12px;line-height:1.6;margin-top:10px;">
      Need to change anything? Reply to this email or message the owner from your dashboard.
    </p>
    """
    subject = (
        f"Booking confirmed — {property_title}"
        if is_confirmed
        else f"Booking request received — {property_title}"
    )
    return await send_email(
        to_email,
        subject,
        _wrap(inner, preheader=f"{property_title} · {check_in} → {check_out}"),
        tag="booking-confirmation",
    )


async def send_booking_notification_email(
    to_email: str,
    owner_name: str,
    guest_name: str,
    guest_email: str,
    property_title: str,
    property_location: str,
    check_in: str,
    check_out: str,
    total_price: Optional[float],
    currency: str = "USD",
    booking_id: Optional[str] = None,
    is_pending: bool = False,
) -> bool:
    """Email sent to the OWNER/MANAGER notifying of a new booking or request."""
    headline = "New booking request" if is_pending else "New booking received 🎉"
    subhead = (
        "A guest has requested to book your property. Review and accept from your dashboard."
        if is_pending
        else "A guest has just booked your property. Here are the details:"
    )
    price_row = ""
    if total_price is not None:
        currency_symbol = "₪" if currency == "ILS" else "$"
        price_row = _detail_row("Total", f"{currency_symbol}{total_price:,.2f}")

    booking_row = _detail_row("Booking ID", booking_id[:8].upper()) if booking_id else ""

    inner = f"""
    <h2 style="color:#222;font-size:22px;margin:0 0 8px;">{headline}</h2>
    <p style="color:#555;font-size:14px;line-height:1.7;margin:0 0 18px;">
      Hi {owner_name or "there"},<br />{subhead}
    </p>
    <div style="background:#f7f7f4;border-radius:10px;padding:18px 20px;margin:10px 0 20px;border-left:4px solid {BRAND_GOLD if is_pending else BRAND_TEAL};">
      <div style="color:{BRAND_TEAL};font-size:16px;font-weight:700;margin-bottom:4px;">{property_title}</div>
      <div style="color:#777;font-size:13px;margin-bottom:14px;">{property_location}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        {_detail_row("Guest", guest_name)}
        {_detail_row("Guest email", f'<a href="mailto:{guest_email}" style="color:{BRAND_TEAL};text-decoration:none;">{guest_email}</a>')}
        {_detail_row("Check-in", check_in)}
        {_detail_row("Check-out", check_out)}
        {price_row}
        {booking_row}
      </table>
    </div>
    {_button("Open Dashboard", f"{FRONTEND_URL}/dashboard")}
    """
    subject = (
        f"New booking request — {property_title}"
        if is_pending
        else f"New booking — {property_title}"
    )
    return await send_email(
        to_email,
        subject,
        _wrap(inner, preheader=f"{guest_name} · {check_in} → {check_out}"),
        tag="booking-notification",
    )

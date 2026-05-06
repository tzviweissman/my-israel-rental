/**
 * Feature flags. Centralized so we can flip whole feature surfaces on/off
 * without code archaeology.
 *
 * The `DOCUMENT_SERVICES_ENABLED` flag hides the entire "Document Filing
 * Services" / "Bituach Leumi" surface (renter dashboard tab, public
 * /document-service checkout, admin services tab and revenue widget) so the
 * site can launch without that revenue stream. Backend code, PayPal
 * integration, and database schemas are untouched — flip this back to
 * `true` to re-enable everything instantly.
 */
export const DOCUMENT_SERVICES_ENABLED = false;

# "Your order, being made": the photo a business sends the customer

What it does: on the Orders tab, an open order's card (the chevron) has **Send the customer a photo**. The business takes a photo of the order as they make it. It appears at once on the customer's tracking page ("Your order, being made") until the delivery photo replaces it. Once the template below is approved, it also goes to the customer's WhatsApp. Added 18 Nov 2026, after the behind-the-scenes order shots on Gremier's site in our inspo.

It is a button the business chooses to press, so nothing changes for a business that doesn't use it. It is not on the staff board (`/orders/staff/:token`), which has no account to upload with.

## The template (draft, not submitted)

- Name `order_making`, category Utility, header **Image**, no buttons.
- English body: `Hello, your order from {{1}} is being made right now. Here is a photo from the kitchen.\nFollow your order here: {{2}} Thank you for ordering.`
- Hebrew body: `שלום, ההזמנה שלך מ{{1}} בהכנה ממש עכשיו. הנה תמונה מההכנה.\nלמעקב אחרי ההזמנה: {{2}} תודה שהזמנת.`
- Examples: 1 = Blazin Boards / בלייזין בורדס, 2 = https://myisraelrental.com/orders/track/abc123

The business can add one line under the photo ("Fresh out of the oven", up to 120 letters). It shows under the photo on the tracking page. The WhatsApp template has no slot for it.

Under the photo the customer has one button, **Looks great 👍**, with no sign-in (19 Nov 2026). It shows "The customer liked your photo 👍" on the business's order card. A new photo starts fresh. After a like, the review text sent when the order is done opens warmer: "You loved the photo, how was the order from {business}?" (`REVIEW_AFTER_LIKE` in `order_texts.py`). A business that wrote its own review wording keeps its own. Route: `POST /marketplace/orders/track/{token}/making-photo/like`.

Submit it with the form, as described in `docs/whatsapp-order-confirm.md`, because it has an image header. After approval, set `WHATSAPP_TEMPLATE_ORDER_MAKING=order_making` on the backend.

The code: `send_making_photo` in `backend/routes/marketplace/orders.py` (`POST /marketplace/orders/{id}/making-photo`, for the owner or staff with orders access, open orders only, and only photos uploaded through the app). Also `send_order_making_to_customer` in `backend/utils/whatsapp.py`, the button in `frontend/src/components/dashboard/OrderCard.jsx`, and the photo in `frontend/src/pages/OrderTrackPage.jsx`.

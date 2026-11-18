# Delivery photo to the customer: the template

What it does: when the courier marks an order delivered, they take a photo. The customer already gets that photo by email. With this template approved, they also get it on WhatsApp, the way a parcel company shows the parcel at the door. Added 18 Nov 2026, after Bramble's order status, which leads with the item.

Until the template is approved and named on the server, nothing changes: the email with the photo goes out as before.

## The template (submitted 18 Nov 2026, English and Hebrew, in review)

- Name `order_delivered`, category Utility, header **Image** (sample: a board photo), no buttons.
- English body: `Hello, your order from {{1}} was delivered. This is the photo from the delivery.\nYour order and receipt are here: {{2}} Thank you for ordering.`
- Hebrew body: `שלום, ההזמנה שלך מ{{1}} נמסרה. זו התמונה מהמסירה.\nההזמנה והקבלה נמצאות כאן: {{2}} תודה שהזמנת.`
- Meta refuses a body that starts or ends with a {{ }}, which is why each one ends with a thank-you.
- Examples: 1 = Blazin Boards / בלייזין בורדס, 2 = https://myisraelrental.com/orders/track/abc123

{{1}} is the business name and {{2}} the customer's private order link, in that order.

## After approval

Set `WHATSAPP_TEMPLATE_ORDER_DELIVERED=order_delivered` on the backend (restarts it for about a minute). It works only once the alerts are switched on (`WHATSAPP_ACCESS_TOKEN`, see the order of steps in `docs/whatsapp-order-confirm.md`).

The code: `send_order_delivered_to_customer` in `backend/utils/whatsapp.py`, called from the courier's "delivered" step in `backend/routes/marketplace/orders.py`. The message goes in the customer's order language. Only a public `https://` photo is used, because Meta fetches the picture itself.

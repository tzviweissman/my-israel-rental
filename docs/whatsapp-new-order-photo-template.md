# New-order alert with the product photo: the template to submit

What it does: a business's WhatsApp alert for a new order opens with a picture of the first product ordered (or the listing's photo if that product has none). Below it are the same text and the same Confirm and Decline buttons as today. Added 18 Nov 2026, after the order screens in our inspo (Gremier, Bramble), which lead with the product picture.

Until this template is approved and its name is set on the server, nothing changes: the alert goes out exactly as before.

## Submit it (submitted 18 Nov 2026, English and Hebrew, in review)

Where: Meta Business Suite > WhatsApp Manager > Message templates > Create template.

1. Category: **Utility**. Name: `new_order_photo`. Language: English.
2. Header: **Image**. Meta asks for a sample picture: upload any product photo, for example a board from the shop.
3. Body, exactly the approved `new_order_confirm` English words (four lines, see `docs/whatsapp-order-confirm.md`):
   `You received a new {{1}} from {{2}}.` / `Items: {{3}}` / `Order details: {{4}}` / `Please confirm or decline this order with the buttons below.`
4. Buttons > Add a button > **Custom**. Add two, in this order: `Confirm`, then `Decline`.
5. Examples for the {{ }}: 1 = order, 2 = Dani, 3 = 2 x Family board, 4 = https://myisraelrental.com/dashboard
6. Submit. Then create it again under the same name, language **Hebrew**:
   - Header: Image (same sample).
   - Body, the approved `new_order_confirm` Hebrew words (four lines):
     `שלום, קיבלת {{1}} חדשה מהלקוח {{2}} דרך דף העסק שלך.` / `הפריטים בהזמנה: {{3}}` / `לכל פרטי ההזמנה: {{4}}` / `נא לאשר את ההזמנה או לדחות אותה בעזרת הכפתורים שלמטה. ללא מענה, ההזמנה תישאר ממתינה.`
   - Buttons, in this order: `אישור`, then `דחייה`.
   - Examples: 1 = הזמנה, 2 = דני, 3 = 2 x מגש משפחתי, 4 = https://myisraelrental.com/dashboard

The four {{ }} must stay in this order, and Confirm must be the first button: the code fills them in that order, and the first button means Confirm.

## After approval

Set `WHATSAPP_TEMPLATE_NEW_ORDER_PHOTO=new_order_photo` on the backend (Claude does this; it restarts the backend for about a minute). It works only once the alerts themselves are switched on (`WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_TEMPLATE_NEW_ORDER_CONFIRM`, see `docs/whatsapp-order-confirm.md`).

The code: `send_new_order_notification` in `backend/utils/whatsapp.py`. The photo is chosen in `place_website_order` in `backend/routes/marketplace/orders.py`. Meta fetches the picture itself, so only a public `https://` address is used. Anything else gets today's alert without a photo. Bookings have no Confirm buttons on WhatsApp and so never get a photo.

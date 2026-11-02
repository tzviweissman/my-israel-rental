# Order confirm by WhatsApp: what you click

How it works: a customer orders on a business's page. The business gets a WhatsApp message with two buttons, Confirm and Decline. When the owner taps Confirm, the customer gets a WhatsApp message with their private order link, where they see the order and how to pay. Nobody signs in.

Claude sets all the Railway variables. You only do the Meta clicks below.

## 1. Submit two message templates

Meta must approve every message we start. Do each one twice, once in English and once in Hebrew, under the same name.

Where: Meta Business Suite > WhatsApp Manager > Message templates > Create template.

For every template: Category = **Utility**. Name exactly as written below (lowercase, underscores).

### Template A: `new_order_confirm` (to the business)

1. Name: `new_order_confirm`. Language: English. Category: Utility.
2. Body, exactly as submitted:
   `You received a new {{1}} from {{2}}. Items: {{3}} Order details: {{4}} Please confirm or decline this order with the buttons below.`
3. Buttons > Add a button > **Custom**. Add two: `Confirm` and `Decline`.
4. Submit. Then create it again in Hebrew (same name, language Hebrew), with the same four {{ }} in the same order. Buttons: `אישור` and `דחייה`. The Hebrew one was resubmitted with a longer body.

Meta asks for an example for each {{ }}. Use: 1 = order, 2 = Dani, 3 = 2 x Family board, 4 = https://myisraelrental.com/dashboard

The order of the four {{ }} must stay as written, our code fills them in that order.

### Template B: `order_confirmed` (to the customer)

1. Name: `order_confirmed`. Language: English. Category: Utility. No buttons.
2. Body starts: `Your order from {{1}} has been confirmed.` and carries the order link as {{2}}.
3. Create it again in Hebrew with the same two {{ }} in the same order.

Examples: 1 = Blazin Boards, 2 = https://myisraelrental.com/orders/track/abc123

Approval usually takes minutes to a day. When both are approved, tell Claude and it switches the feature on. Until then no WhatsApp goes out at all (Meta's business check has the account locked); owners still get email and the bell.

## 2. Connect the webhook

This is how Meta tells us the owner tapped a button.

1. Go to developers.facebook.com > My Apps > our app > WhatsApp > Configuration.
2. Under Webhook, click Edit.
3. Callback URL: `https://my-israel-rental-production.up.railway.app/api/whatsapp/webhook`
4. Verify token: the value Claude gives you (it is the same one Claude puts in `WHATSAPP_VERIFY_TOKEN`).
5. Click Verify and save.
6. In the Webhook fields list, find **messages** and click Subscribe.
7. The App Secret lets us check that a tap really came from Meta. Do not paste it into the chat. Find it at App settings > Basic > App secret > Show, then put it on Railway yourself: railway.app > the project > the backend service > Variables > New Variable, name `WHATSAPP_APP_SECRET`, value = the secret, Add. Tell Claude when it is there.

## 3. Open question

Meta expects customers to agree to receive WhatsApp messages from a business. Does our order form need a tick box such as "Send me updates about this order on WhatsApp"?

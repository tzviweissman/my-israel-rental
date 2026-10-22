# Tzvi's decisions, 22 Oct 2026 (the four open questions from the category rework)

1. **Look-alike sites:** change the newer site in each pair. Add the missing fingerprint entries (kashermybnb, lechem-emek) and fix the `the-gift-boutique` key in `scrollcraft/fingerprints.json`.
2. **L.A. Cholent films:** keep them dark. Answer R3h.11 with this decision.
3. **Blazin' Boards name:** keep it cream (accent colour only on the main button).
4. **Product hero shots, all approved:**
   - food shops: about 25 photos, about 50 credits
   - RS skirt: 1 photo, about 2 credits
   - ~~Gift Boutique: 22 photos, about 44 credits~~ DROPPED (Tzvi, 22 Oct): she has her own one-shoot photos now (see `scrollcraft/builds/gift-boutique/gen/catalog/whatsapp-catalog-2026-10-22.md`). Tzvi is getting her full-size originals; use those.
   - Gift Boutique phone film: about 10 credits

   About 62 credits in total, out of about 620. Run one job at a time and call `get_cost` before each one.

5. **Gift Boutique, build your own gift: yes** (Tzvi, 22 Oct). The order page lets a customer pick single pieces (napkin holders, bowls, place mats, glasses, openers, baby items) into one gift, with a running total. The order is saved, then sent on WhatsApp, the same way as the other orders. The ready-made gifts stay as they are. Ask the owner how the wrapping or box is priced and whether there is a minimum before building the price line.

Next: apply these, re-run the checks and `check-rules` on every site you touch, commit, and show Tzvi. Don't push or publish until he says so.

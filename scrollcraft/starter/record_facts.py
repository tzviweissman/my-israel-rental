"""What the order form must send, and what to check against the owner's own pictures (Tzvi, 16 Nov 2026, from the
Clean Plus build: the booking form was refused until publish because the listing takes appointments, and the flyer's
phone number and the listing's "4 hours" visit of 60 minutes were found one at a time).

fetch_business.py prints this after the record. On a build already fetched:

    python scrollcraft/starter/record_facts.py scrollcraft/builds/<folder>/src/record.json

Prints:
  BOOKING   per listing, the fields the server's /book needs (what gigs.py refuses without them)
  MATCH     every phone and price in the record, to compare against flyers, menus and screenshots on the sheet
  ASK FIRST contradictions inside the record itself; each goes to the top of OWNER-QUESTIONS.md
"""
import json
import re
import sys

NEEDS = {
    'appointment': 'tier_name (exactly as listed), preferred_date, time_slot "HH:MM" inside weekly_availability '
                   'and long enough for the visit; grey out times from GET /gigs/<id>/taken-slots',
    'store': 'no bookings: orders go through /marketplace/order-form/<id>/orders',
}
HOURS = re.compile(r'(\d+(?:[.,]\d+)?)\s*(?:hours?|hrs?|h\b|שעות|שעה)', re.I)
MINS = re.compile(r'(\d+)\s*(?:minutes?|mins?|דקות)', re.I)


def digits(p):
    d = re.sub(r'\D', '', str(p or ''))
    return '972' + d[1:] if d.startswith('0') else d


def facts(record):
    biz, gigs = record.get('business') or {}, record.get('listings') or []
    out, ask, phones = [], [], {}
    for k, v in biz.items():
        if v and isinstance(v, str) and any(s in k for s in ('phone', 'whatsapp')):
            phones.setdefault(digits(v), []).append('business.' + k)
    for g in gigs:
        typ = g.get('gig_type') or 'deliverable'
        out.append(f"BOOKING {g.get('title')} [{typ}] id {g.get('_id')}: "
                   + NEEDS.get(typ, 'tier_name (exactly as listed), preferred_date; amount 0 for anything priced later'))
        if typ == 'appointment' and g.get('weekly_availability'):
            out.append(f"  open hours {json.dumps(g['weekly_availability'])}")
        if g.get('whatsapp'):
            phones.setdefault(digits(g['whatsapp']), []).append(f"listing '{g.get('title')}'")
        for t in (g.get('tiers') or []) + (g.get('products') or []):
            dm = t.get('duration_minutes')
            out.append(f"MATCH price: {t.get('name')} = {t.get('price')} {t.get('currency') or ''}"
                       + (f", {dm} minutes" if dm else ''))
            text = f"{t.get('name') or ''} {t.get('description') or ''}"
            h, m = HOURS.search(text), MINS.search(text)
            said = float(h.group(1).replace(',', '.')) * 60 if h else (int(m.group(1)) if m else None)
            if said and dm and abs(said - dm) >= 15:
                ask.append(f"'{t.get('name')}' says {said:g} minutes but the listing books {dm} minutes, so a booking "
                           f"blocks only {dm} minutes of their calendar. Which is right? (they fix it in the dashboard)")
    for p, where in phones.items():
        out.append(f"MATCH phone: +{p} ({', '.join(where)})")
    if len(phones) > 1:
        ask.append('The record has more than one number: ' + ', '.join('+' + p for p in phones) + '. Which takes WhatsApp?')
    out.append('MATCH: read every flyer, menu and screenshot on the sheet for phones, prices and times; '
               'any that differ from the lines above go under ASK FIRST in OWNER-QUESTIONS.md (rules 0b.1b)')
    out += [f"ASK FIRST {a}" for a in ask]
    return out, ask


if __name__ == '__main__':
    if len(sys.argv) > 1:
        with open(sys.argv[1], encoding='utf8') as f:
            print('\n'.join(facts(json.load(f))[0]))
    else:  # self-check: the Clean Plus case
        _, ask = facts({'business': {'phone': '058-713-0664'}, 'listings': [{'title': 'Clean', 'gig_type': 'appointment',
              'whatsapp': '+972504232291', 'tiers': [{'name': 'Weekly cleaning 4 hours', 'price': 325, 'duration_minutes': 60}]}]})
        assert len(ask) == 2 and '240 minutes' in ask[0] and '+972587130664' in ask[1], ask
        _, ask = facts({'listings': [{'gig_type': 'appointment', 'whatsapp': '0501234567',
              'tiers': [{'name': 'Haircut 45 minutes', 'duration_minutes': 45}]}]})
        assert ask == [], ask
        print('ok')

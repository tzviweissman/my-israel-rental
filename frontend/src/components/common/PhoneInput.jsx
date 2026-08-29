import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { DIAL_CODES, splitPhone, joinPhone } from '../../utils/phoneFormat';

/**
 * Phone entry as a country selector plus a local number.
 *
 * This is not only cosmetic. A bare string of digits with no country code is
 * genuinely ambiguous, and we used to guess: "553304424" (an Israeli mobile
 * typed without its 0) was dialled as +55 Brazil, and "732 723 8572" (New
 * Jersey) as +7 Russia. Making the country an explicit, always-present
 * choice removes the ambiguity at the source instead of validating after
 * the fact.
 *
 * The component always emits `+<dial><local>` — explicit international
 * format — which `normalizeWhatsAppNumber` accepts without inference.
 */

/**
 * @param {string}   value    full number, e.g. "+972501234567"
 * @param {function} onChange receives the combined value
 * @param {string}   error    validation message to show, if any
 */
const PhoneInput = ({
  value,
  onChange,
  error = '',
  hint = '',
  testid = 'phone',
  autoComplete = 'tel',
}) => {
  const { t } = useTranslation();
  const parsed = splitPhone(value);
  const local = parsed.local;

  /* THE COUNTRY HAS TO BE REMEMBERED WHEN THE NUMBER BOX IS EMPTY.

     The selector used to read its value straight back out of `value`, and
     `joinPhone` returns '' for an empty local number — correctly, because
     a country code on its own is not a phone number and must not be
     stored as one. But that meant picking a country with the number box
     still empty round-tripped to '', `splitPhone('')` answered with the
     default, and the selector snapped back to +972. Every attempt to
     choose a country failed, silently, and the phone field is optional so
     it is empty for everyone at signup — and the selector is the first
     control in the row, so choosing the country first is the natural
     order. Typing the number first happened to work, which is why this
     could look fine while being broken.

     So: the country comes from `value` whenever `value` actually carries
     a number (a pasted +1 number still moves the selector), and from the
     last explicit pick when it does not. `value` stays '' either way. */
  const [pickedDial, setPickedDial] = useState(null);
  const dial = local ? parsed.dial : (pickedDial || parsed.dial);

  /* AND THE COUNTRY OF A NUMBER THAT WAS ALREADY THERE.

     The paragraph above fixed this for a country the user PICKS and for
     one they PASTE. It did not cover the third way a country gets
     chosen, which is the commonest: the number was already in the field.

     Somebody editing a saved +1 732 number who clears the digits to
     retype them ended up with +972. `pickedDial` was never set — they
     had not picked or pasted anything — so the moment `local` went
     empty the expression above fell through to `splitPhone('')`, which
     answers with the default. The selector moved on its own, and the
     number they then typed was stored under the wrong country. Nothing
     looked wrong: the field showed a country and a number, both
     plausible, and the number was unreachable.

     So: whenever the value actually carries a number, remember ITS
     country. Guarded on inequality because this runs on every render
     and an unguarded setState here is a loop. */
  useEffect(() => {
    if (local && parsed.dial && parsed.dial !== pickedDial) {
      setPickedDial(parsed.dial);
    }
  }, [local, parsed.dial, pickedDial]);

  const setDial = (nextDial) => {
    setPickedDial(nextDial);
    onChange(joinPhone(nextDial, local));
  };

  /* People paste whole numbers into the local box - off a business card,
     out of Contacts, from their own WhatsApp - and the box is sitting
     next to a country selector that already says +972. That is how one
     real listing ended up as "+972972533270020", unreachable.
     
     So a pasted value that states its own country is treated as the
     whole number: the selector moves to match and the local part is
     whatever is left. Anything else goes through joinPhone, which drops
     a trunk 0 and a repeated country code. Nothing to explain, no error
     to read - the field just takes what it is given. */
  const setLocal = (nextLocal) => {
    const raw = String(nextLocal ?? '');
    const digits = raw.replace(/\D/g, '');
    const statesItsOwnCountry = /^[\s(]*\+/.test(raw) || digits.startsWith('00');
    if (statesItsOwnCountry && digits) {
      const bare = digits.startsWith('00') ? digits.slice(2) : digits;
      const pasted = splitPhone(bare);
      // Kept in step with the selector, so clearing the box afterwards
      // leaves the pasted number's country showing rather than reverting
      // to Israel behind the reader's back.
      setPickedDial(pasted.dial);
      onChange(joinPhone(pasted.dial, pasted.local));
      return;
    }
    onChange(joinPhone(dial, raw));
  };

  const boxBase = 'rounded-xl border bg-white text-sm transition-colors focus:outline-none focus:ring-2';
  const boxState = error
    ? 'border-red-300 focus:border-red-400 focus:ring-red-200/50'
    : 'border-gray-300 focus:border-[var(--brand-primary)] focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20';

  /* A bare <select> renders the operating system's own control: Windows
     draws a small grey arrow in a slightly different grey box, and the
     closed value is set in the OS UI font rather than the page's. Next to
     a hand-styled input it reads as a piece of a different form — which
     is what "it doesn't look nice, maybe it's the font" is describing.

     `appearance-none` drops the OS chrome so the box inherits the page's
     type and our border, and the chevron below replaces the arrow it
     removes. This does NOT change behaviour on a phone: tapping still
     opens the native picker, which is the right control there and the
     reason this stays a real <select> rather than a custom listbox. */
  const selectChrome = 'appearance-none bg-none font-medium tabular-nums text-[var(--ink)]';

  return (
    <div>
      {/* Two separate boxes rather than one field with a prefix inside it:
          the country is a choice, and it should look like one. `flex` +
          logical spacing keeps the order correct in RTL automatically. */}
      <div className="flex gap-2">
        {/* `dir="ltr"` on the WRAPPER, not just the select: the box holds a
            flag and digits, which read left-to-right in any language, so
            the chevron belongs at its right edge in both directions. The
            row itself still flips, because that is the flex parent's job. */}
        <div className="relative shrink-0" dir="ltr">
          <select
            value={dial}
            onChange={(e) => setDial(e.target.value)}
            className={`${boxBase} ${boxState} ${selectChrome} ps-3 pe-8 py-3 w-[7.25rem] cursor-pointer`}
            aria-label={t('phone.countryCode', 'Country code')}
            data-testid={`${testid}-country`}
          >
            {/* NO FLAG EMOJI, and that is the fix rather than a downgrade.

                Windows ships no glyphs for regional-indicator pairs, so
                🇺🇸 renders as a bare lowercase "us" in whatever fallback
                font the OS picks — different face, different size, sitting
                next to text set in Manrope. That mismatch is what looked
                broken, and it looked broken only on the platform most
                visitors are using.

                The ISO code is real text: identical on every platform,
                unambiguous next to the dial code, and no better or worse
                on a Mac than on a phone. */}
            {DIAL_CODES.map((c) => (
              <option key={c.code} value={c.dial}>
                {c.code}  +{c.dial}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
        </div>
        <input
          type="tel"
          inputMode="tel"
          autoComplete={autoComplete}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder={dial === '972' ? '50 123 4567' : '555 123 4567'}
          // Numbers are always read left-to-right, even in a Hebrew page.
          dir="ltr"
          className={`${boxBase} ${boxState} px-4 py-3 flex-1 min-w-0`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={`${testid}-help`}
          data-testid={`${testid}-input`}
        />
      </div>
      <p
        id={`${testid}-help`}
        className={`text-[11px] mt-1 ${error ? 'text-red-600' : 'text-gray-500'}`}
        data-testid={`${testid}-help`}
      >
        {error || hint || t(
          'phone.dropLeadingZero',
          'Pick your country, then the rest of the number — no need for the leading 0.',
        )}
      </p>
    </div>
  );
};

export default PhoneInput;

import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { dial, local } = splitPhone(value);

  const setDial = (nextDial) => onChange(joinPhone(nextDial, local));
  const setLocal = (nextLocal) => onChange(joinPhone(dial, nextLocal));

  const boxBase = 'rounded-xl border bg-white text-sm transition-colors focus:outline-none focus:ring-2';
  const boxState = error
    ? 'border-red-300 focus:border-red-400 focus:ring-red-200/50'
    : 'border-gray-300 focus:border-[#1E6A6A] focus:ring-[#1E6A6A]/20';

  return (
    <div>
      {/* Two separate boxes rather than one field with a prefix inside it:
          the country is a choice, and it should look like one. `flex` +
          logical spacing keeps the order correct in RTL automatically. */}
      <div className="flex gap-2">
        <select
          value={dial}
          onChange={(e) => setDial(e.target.value)}
          className={`${boxBase} ${boxState} px-2 py-3 w-[7.5rem] shrink-0 cursor-pointer`}
          aria-label={t('phone.countryCode', 'Country code')}
          data-testid={`${testid}-country`}
          dir="ltr"
        >
          {DIAL_CODES.map((c) => (
            <option key={c.code} value={c.dial}>
              {c.flag} +{c.dial}
            </option>
          ))}
        </select>
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

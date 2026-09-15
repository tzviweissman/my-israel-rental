import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { apiErrorMessage } from '../../utils/apiError';
import { RESERVED_SLUGS, SLUG_PATTERN, SITE_HOST, SUBDOMAINS_ON } from '../../utils/businessHost';

/**
 * "Your web address" — the owner picks <slug>.myisraelrental.com.
 *
 * WHY THE OWNER HAS TO BE ABLE TO. The address is derived from the business
 * name, and a Hebrew name derives nothing: slugify deliberately does not
 * transliterate, so the business gets business-a3f9c2d1. Fine as a path,
 * useless as something to print on a van.
 *
 * Changing it goes through the same rule a rename does: the old address
 * retires into the business's history and keeps opening the page, so a
 * printed flyer is never broken by a change here.
 *
 * Shape and reserved words are checked locally, instantly; only a
 * well-formed candidate costs a request, and only after typing pauses.
 */
const FALLBACK_SLUG = /^business-[0-9a-f]{8}$/;

export default function WebAddressField({ business, API, token, onChanged }) {
  const { t } = useTranslation();
  // What the address is NOW. Starts from the record and follows a
  // successful change here, since the parent's copy may not refresh.
  const [saved, setSaved] = useState(null);
  const current = saved ?? (business?.slug || '');
  const [value, setValue] = useState(current);
  const [remote, setRemote] = useState({ address: null, state: null });
  const [saving, setSaving] = useState(false);

  const address = value.trim().toLowerCase();
  // Answers that need no server. Derived, not stored, so there is no
  // render in which the badge disagrees with the text in the box.
  let localState = null;
  if (address === current) localState = 'current';
  else if (!SLUG_PATTERN.test(address)) localState = 'invalid';
  else if (RESERVED_SLUGS.has(address)) localState = 'reserved';

  useEffect(() => {
    if (localState || !business?.id) return undefined;
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const { data } = await axios.get(
          `${API}/marketplace/businesses/${business.id}/web-address/check`,
          { params: { address }, headers: { Authorization: `Bearer ${token}` } },
        );
        if (!stale) setRemote({ address, state: data.available ? 'available' : (data.reason || 'taken') });
      } catch {
        if (!stale) setRemote({ address, state: 'error' });
      }
    }, 400);
    return () => { stale = true; clearTimeout(timer); };
  }, [address, localState, API, business?.id, token]);

  const state = localState || (remote.address === address ? remote.state : 'checking');

  const label = (slug) => (SUBDOMAINS_ON ? `${slug}.${SITE_HOST}` : `${SITE_HOST}/business/${slug}`);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await axios.put(
        `${API}/marketplace/businesses/${business.id}/web-address`,
        { address },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const next = data?.slug || address;
      setSaved(next);
      setValue(next);
      toast.success(t('businesses.webAddress.saved', 'Your web address is now {{address}}', { address: label(next) }));
      onChanged && onChanged();
    } catch (err) {
      toast.error(
        apiErrorMessage(err, t('businesses.webAddress.saveFailed', 'Could not change the address.'), t),
        { duration: 8000 },
      );
    } finally {
      setSaving(false);
    }
  };

  const message = {
    current: t('businesses.webAddress.current', 'This is your address now.'),
    checking: t('businesses.webAddress.checking', 'Checking…'),
    available: t('businesses.webAddress.available', 'Available'),
    taken: t('businesses.webAddress.taken', 'Another business already uses this address.'),
    reserved: t('businesses.webAddress.reserved', 'This address is reserved for the site. Try another.'),
    invalid: t('businesses.webAddress.invalid', 'Use lowercase English letters, numbers and hyphens, not at the start or end.'),
    error: t('businesses.webAddress.error', 'Could not check right now.'),
  }[state];

  // Green is functional here, which is the one use the design system
  // allows it: this line reports availability.
  const tone = state === 'available'
    ? { color: '#2E7D4F' }
    : state === 'current' || state === 'checking'
      ? { color: 'var(--brand-muted)' }
      : { color: '#B42318' };

  return (
    <div className="pb-4 border-b" style={{ borderColor: 'var(--brand-border)' }} data-testid="web-address-field">
      <span className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>
        {t('businesses.webAddress.title', 'Your web address')}
      </span>
      {/* An address reads left to right in every language, so the row is
          LTR even on the Hebrew page; the words around it are not. */}
      <div
        dir="ltr"
        className="mt-1 flex items-stretch rounded-lg border overflow-hidden text-sm"
        style={{ borderColor: 'var(--brand-border)' }}
      >
        {!SUBDOMAINS_ON && (
          <span className="px-2 flex items-center bg-gray-50 shrink-0" style={{ color: 'var(--brand-muted)' }}>
            {`${SITE_HOST}/business/`}
          </span>
        )}
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          maxLength={60}
          aria-label={t('businesses.webAddress.inputAria', 'Web address')}
          className="min-w-0 flex-1 px-3 py-2 outline-none"
          data-testid="web-address-input"
        />
        {SUBDOMAINS_ON && (
          <span className="px-2 flex items-center bg-gray-50 shrink-0" style={{ color: 'var(--brand-muted)' }}>
            {`.${SITE_HOST}`}
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] inline-flex items-center gap-1" style={tone} data-testid="web-address-status" data-state={state}>
          {state === 'checking' && <Loader2 size={11} className="animate-spin" />}
          {message}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={state !== 'available' || saving}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-40"
          style={{ background: 'var(--brand-primary)' }}
          data-testid="web-address-save"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          {t('businesses.webAddress.use', 'Use this address')}
        </button>
      </div>
      {FALLBACK_SLUG.test(current) && state === 'current' && (
        <p className="mt-1 text-[11px]" style={{ color: 'var(--brand-muted)' }} data-testid="web-address-nudge">
          {t('businesses.webAddress.pickMemorable', 'Pick an address people can remember and type.')}
        </p>
      )}
      <p className="mt-1 text-[11px]" style={{ color: 'var(--brand-muted)' }}>
        {t('businesses.webAddress.hint', 'Your old address keeps working, so anything you have already shared or printed still opens your page.')}
      </p>
    </div>
  );
}
